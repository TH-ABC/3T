
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, X, GripVertical, Trash2, CheckSquare, 
  Square, MoreVertical, Layout, StickyNote,
  ChevronRight, ChevronLeft, Maximize2, Minimize2,
  Save, Loader2
} from 'lucide-react';
import { DailyNoteItem, PlannerColumn, User, UserNote } from '../types';
import { sheetService } from '../services/sheetService';
import { supabase } from '../lib/supabase';

interface PlannerProps {
  user: User;
}

export const Planner: React.FC<PlannerProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [columns, setColumns] = useState<PlannerColumn[]>([]);
  const [items, setItems] = useState<DailyNoteItem[]>([]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 1000, height: 650 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [tempColumnTitle, setTempColumnTitle] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Sử dụng múi giờ Việt Nam (GMT+7) để lấy ngày chính xác
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('username', user.username)
        .eq('date', today)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setItems(data.items || []);
        setColumns(data.columns || [
          { id: 'col-todo', title: 'To Do', order: 0 },
          { id: 'col-doing', title: 'Doing', order: 1 },
          { id: 'col-done', title: 'Done', order: 2 }
        ]);
      } else {
        // Default columns if no data exists for today
        setColumns([
          { id: 'col-todo', title: 'To Do', order: 0 },
          { id: 'col-doing', title: 'Doing', order: 1 },
          { id: 'col-done', title: 'Done', order: 2 }
        ]);
        setItems([]);
      }
    } catch (error) {
      console.error('Error fetching planner data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const savePlanner = (
    updatedItems: DailyNoteItem[] = items, 
    updatedColumns: PlannerColumn[] = columns
  ) => {
    // Debounce saving to avoid too many requests
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    setSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
        const { error } = await supabase
          .from('user_notes')
          .upsert({
            username: user.username,
            date: today,
            items: updatedItems,
            columns: updatedColumns,
            show_planner: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'username,date' });
          
        if (error) throw error;
      } catch (error) {
        console.error('Error saving planner:', error);
      } finally {
        setSaving(false);
      }
    }, 1000); // Wait 1 second after last change before saving
  };

  const addColumn = () => {
    if (!newColumnTitle.trim()) return;
    const newCol: PlannerColumn = {
      id: 'col-' + Date.now(),
      title: newColumnTitle.trim(),
      order: columns.length
    };
    const updated = [...columns, newCol];
    setColumns(updated);
    setNewColumnTitle('');
    setAddingColumn(false);
    savePlanner(items, updated);
  };

  const deleteColumn = (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa cột này?')) return;
    const updatedCols = columns.filter(c => c.id !== id);
    const updatedItems = items.filter(i => i.columnId !== id);
    setColumns(updatedCols);
    setItems(updatedItems);
    savePlanner(updatedItems, updatedCols);
  };

  const updateColumnTitle = (id: string) => {
    if (!tempColumnTitle.trim()) {
      setEditingColumnId(null);
      return;
    }
    const updated = columns.map(c => c.id === id ? { ...c, title: tempColumnTitle.trim() } : c);
    setColumns(updated);
    setEditingColumnId(null);
    savePlanner(items, updated);
  };

  const addItem = (columnId: string) => {
    if (!newItemTitle.trim()) return;
    const newItem: DailyNoteItem = {
      id: 'item-' + Date.now(),
      title: newItemTitle.trim(),
      text: newItemText.trim(),
      content: newItemText.trim(),
      images: newItemImages,
      completed: false,
      columnId: columnId
    };
    const updated = [...items, newItem];
    setItems(updated);
    setNewItemTitle('');
    setNewItemText('');
    setNewItemImages([]);
    setActiveColumnId(null);
    savePlanner(updated);
  };

  const updateItem = (id: string, updates: Partial<DailyNoteItem>) => {
    const updated = items.map(item => item.id === id ? { ...item, ...updates } : item);
    setItems(updated);
    savePlanner(updated);
  };

  const toggleItem = (id: string) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(updated);
    savePlanner(updated);
  };

  const deleteItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    savePlanner(updated);
  };

  const moveItem = (itemId: string, targetColumnId: string) => {
    const updated = items.map(item => 
      item.id === itemId ? { ...item, columnId: targetColumnId } : item
    );
    setItems(updated);
    savePlanner(updated);
  };

  // Drag and drop detection for columns
  // Drag and drop detection for columns
  const handleDragEndItem = (event: any, info: any, itemId: string) => {
    const dropX = info.point.x;
    const dropY = info.point.y;
    
    // Find column under drop point
    const columnElements = document.querySelectorAll('[data-column-id]');
    let targetColumnId = null;

    columnElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (
        dropX >= rect.left && 
        dropX <= rect.right && 
        dropY >= rect.top && 
        dropY <= rect.bottom
      ) {
        targetColumnId = el.getAttribute('data-column-id');
      }
    });

    if (targetColumnId) {
      moveItem(itemId, targetColumnId);
    }
  };

  const [newItemImages, setNewItemImages] = useState<string[]>([]);

  const handlePaste = async (e: React.ClipboardEvent, itemId: string | null = null) => {
    const items_clipboard = e.clipboardData.items;
    for (let i = 0; i < items_clipboard.length; i++) {
      if (items_clipboard[i].type.indexOf('image') !== -1) {
        const blob = items_clipboard[i].getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            // Compress image using canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Use lower quality to save space in Google Sheets
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
            
            if (itemId) {
              const item = items.find(it => it.id === itemId);
              if (item) {
                const updatedImages = [...(item.images || []), compressedBase64];
                updateItem(itemId, { images: updatedImages });
              }
            } else {
              setNewItemImages(prev => [...prev, compressedBase64]);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const removeImage = (itemId: string, index: number) => {
    const item = items.find(it => it.id === itemId);
    if (item && item.images) {
      const updatedImages = item.images.filter((_, i) => i !== index);
      updateItem(itemId, { images: updatedImages });
    }
  };

  const handleResize = (e: React.MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = Math.max(300, e.clientX - position.x);
    const newHeight = Math.max(200, e.clientY - position.y);
    
    const newSize = { width: newWidth, height: newHeight };
    setSize(newSize);
    localStorage.setItem('planner_size', JSON.stringify(newSize));
  };

  const stopResizing = () => {
    if (isResizing) {
      setIsResizing(false);
      // No longer saving size to BE
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize as any);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', handleResize as any);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, position, size]);

  return (
    <>
      {/* Floating Icon */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-[100] w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 transition-colors"
      >
        <Layout size={24} />
      </motion.button>

      {/* Draggable Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragMomentum={false}
            dragListener={!isResizing}
            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%', left: '50%', top: '50%' }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              x: '-50%',
              y: '-50%',
              left: '50%', 
              top: '50%',
              width: isMinimized ? 300 : size.width,
              height: isMinimized ? 60 : size.height
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-[110] bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] border border-slate-200 overflow-hidden flex flex-col"
            style={{ touchAction: 'none' }}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-move">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Layout size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase leading-none">Planner</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {saving ? 'Đang lưu...' : 'Đã đồng bộ'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <div className="flex-1 overflow-x-auto p-6 flex gap-6 custom-scrollbar bg-[#f8fafc]">
                {loading ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-50">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Đang tải dữ liệu...</span>
                  </div>
                ) : (
                  <>
                    {columns.sort((a, b) => a.order - b.order).map(column => (
                      <div 
                        key={column.id} 
                        data-column-id={column.id}
                        className="w-72 flex-shrink-0 flex flex-col gap-4"
                      >
                        <div className="flex items-center justify-between px-2 group">
                          {editingColumnId === column.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                autoFocus
                                type="text"
                                value={tempColumnTitle}
                                onChange={(e) => setTempColumnTitle(e.target.value)}
                                onBlur={() => updateColumnTitle(column.id)}
                                onKeyDown={(e) => e.key === 'Enter' && updateColumnTitle(column.id)}
                                className="flex-1 bg-white border border-indigo-300 rounded px-2 py-1 text-xs font-black uppercase outline-none"
                              />
                            </div>
                          ) : (
                            <h4 
                              onClick={() => {
                                setEditingColumnId(column.id);
                                setTempColumnTitle(column.title);
                              }}
                              className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              {column.title}
                              <span className="ml-2 px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[8px]">
                                {items.filter(i => i.columnId === column.id).length}
                              </span>
                            </h4>
                          )}
                          <button 
                            onClick={() => deleteColumn(column.id)}
                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="flex-1 bg-slate-100/50 rounded-2xl p-3 border border-slate-200/60 space-y-3 overflow-y-auto custom-scrollbar min-h-[100px]">
                          {items.filter(i => i.columnId === column.id).map(item => (
                            <motion.div
                              layout
                              key={item.id}
                              drag
                              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                              dragElastic={0.1}
                              onDragEnd={(e, info) => handleDragEndItem(e, info, item.id)}
                              className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 group hover:border-indigo-200 transition-all cursor-grab active:cursor-grabbing relative z-10"
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                                    className={`mt-0.5 transition-colors ${item.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                                  >
                                    {item.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                                  </button>
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                                  >
                                    <h5 className={`text-[11px] font-black uppercase tracking-tight ${item.completed ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                      {item.title || item.text.substring(0, 20)}
                                    </h5>
                                    <p className={`text-[10px] font-medium mt-1 line-clamp-2 ${item.completed ? 'text-slate-200' : 'text-slate-500'}`}>
                                      {item.text}
                                    </p>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={12} />
                                  </button>
                                </div>

                                {editingItemId === item.id && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="pt-2 border-t border-slate-50 space-y-3"
                                  >
                                    <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tiêu đề</label>
                                      <input 
                                        type="text"
                                        value={item.title || ''}
                                        onChange={(e) => updateItem(item.id, { title: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/10"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block flex justify-between items-center">
                                        <span>Nội dung chi tiết (Có thể dán ảnh Ctrl+V)</span>
                                        {item.images && item.images.length > 0 && (
                                          <span className="text-indigo-500">{item.images.length} ảnh</span>
                                        )}
                                      </label>
                                      <textarea 
                                        value={item.text}
                                        onPaste={(e) => handlePaste(e, item.id)}
                                        onChange={(e) => updateItem(item.id, { text: e.target.value, content: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none"
                                        rows={4}
                                      />
                                    </div>

                                    {/* Image Preview Area */}
                                    {item.images && item.images.length > 0 && (
                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                        {item.images.map((img, idx) => (
                                          <div key={idx} className="relative group/img rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                                            <img 
                                              src={img} 
                                              alt={`Pasted ${idx}`} 
                                              className="w-full h-full object-cover"
                                              referrerPolicy="no-referrer"
                                            />
                                            <button 
                                              onClick={() => removeImage(item.id, idx)}
                                              className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg"
                                            >
                                              <X size={10} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex justify-end">
                                      <button 
                                        onClick={() => setEditingItemId(null)}
                                        className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
                                      >
                                        Đóng
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          ))}

                          {activeColumnId === column.id ? (
                            <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm space-y-3 animate-fade-in">
                              <input
                                autoFocus
                                type="text"
                                value={newItemTitle}
                                onChange={(e) => setNewItemTitle(e.target.value)}
                                placeholder="Tiêu đề thẻ..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500/10"
                              />
                              <textarea
                                value={newItemText}
                                onPaste={(e) => handlePaste(e, null)}
                                onChange={(e) => setNewItemText(e.target.value)}
                                placeholder="Nội dung chi tiết..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-inner resize-none"
                                rows={3}
                              />
                              
                              {/* New Item Image Preview */}
                              {newItemImages.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 px-1">
                                  {newItemImages.map((img, idx) => (
                                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                                      <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      <button 
                                        onClick={() => setNewItemImages(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute top-0.5 right-0.5 p-0.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X size={8} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => addItem(column.id)}
                                  className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                >
                                  Thêm
                                </button>
                                <button 
                                  onClick={() => setActiveColumnId(null)}
                                  className="px-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setActiveColumnId(column.id)}
                              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={14} strokeWidth={3} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Thêm thẻ</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add Column Button */}
                    <div className="w-72 flex-shrink-0">
                      {addingColumn ? (
                        <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm space-y-3 animate-fade-in">
                          <input 
                            autoFocus
                            type="text"
                            value={newColumnTitle}
                            onChange={(e) => setNewColumnTitle(e.target.value)}
                            placeholder="Tên cột mới..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={addColumn}
                              className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all"
                            >
                              Tạo cột
                            </button>
                            <button 
                              onClick={() => setAddingColumn(false)}
                              className="px-3 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setAddingColumn(true)}
                          className="w-full py-4 bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={16} strokeWidth={3} />
                          <span className="text-[11px] font-black uppercase tracking-widest">Thêm cột</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Resize Handle */}
            {!isMinimized && (
              <div 
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsResizing(true);
                }}
                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center group/resize"
              >
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full group-hover/resize:bg-indigo-500 transition-colors" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
