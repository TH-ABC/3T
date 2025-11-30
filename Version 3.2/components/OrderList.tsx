
import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw, Copy, ArrowUp, ArrowDown, Save, ExternalLink, Calendar, FileSpreadsheet, ChevronLeft, ChevronRight, UserCircle, CheckSquare, Square, Trash2, Edit, Loader2, FolderPlus, AlertTriangle, Info, X } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store, User, OrderItem } from '../types';

// Helper: Lấy tháng hiện tại theo giờ địa phương (YYYY-MM)
const getCurrentLocalMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

// --- HIERARCHY CONFIGURATION ---
const ROLE_HIERARCHY: Record<string, number> = {
    'admin': 1,
    'leader': 2,
    'idea': 3,
    'support': 4,
    'designer': 5,
    'designer online': 5
};

const getRoleLevel = (role: string): number => {
    return ROLE_HIERARCHY[(role || '').toLowerCase().trim()] || 99; // 99 = Unknown/Lowest
};

interface OrderListProps {
    user?: User; 
    onProcessStart?: () => void;
    onProcessEnd?: () => void;
}

// --- SYSTEM MESSAGE MODAL INTERFACE ---
interface SystemModalState {
    isOpen: boolean;
    type: 'success' | 'error' | 'confirm' | 'alert';
    title: string;
    message: string;
    onConfirm?: () => void;
}

const OrderList: React.FC<OrderListProps> = ({ user, onProcessStart, onProcessEnd }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [units, setUnits] = useState<string[]>([]); 
  const [allUsers, setAllUsers] = useState<User[]>([]); // Load danh sách user để assign
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentLocalMonth());
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  
  // --- TRACKING BACKGROUND UPDATES ---
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set());

  // --- MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Used for Blocking Wait (New File creation)
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null); // To track which ID is being edited

  // --- SYSTEM MODAL STATE (Custom replacement for prompt/alert) ---
  const [sysModal, setSysModal] = useState<SystemModalState>({ isOpen: false, type: 'alert', title: '', message: '' });

  // --- FORM STATE ---
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  
  // State cho thông tin chung
  const [formDataCommon, setFormDataCommon] = useState({
    id: '', 
    date: new Date().toISOString().split('T')[0], 
    storeId: ''
  });

  // State cho thông tin xử lý (Extra fields for edit/add)
  const [formDataExtra, setFormDataExtra] = useState({
      tracking: '',
      link: '',
      status: 'Pending',
      actionRole: '',
      isChecked: false
  });

  // State cho danh sách sản phẩm (items)
  const [formItems, setFormItems] = useState<OrderItem[]>([
    { sku: '', type: 'Printway', quantity: 1, note: '' }
  ]);

  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  // Initialize Metadata Once
  useEffect(() => {
      const fetchMetadata = async () => {
          try {
              const [storeData, unitList, userList] = await Promise.all([
                  sheetService.getStores(),
                  sheetService.getUnits(),
                  sheetService.getUsers()
              ]);
              setStores(storeData);
              setUnits(unitList);
              setAllUsers(userList);
          } catch (e) { console.error("Error fetching metadata", e); }
      };
      fetchMetadata();
  }, []);

  // Optimized loadData - Only fetches orders
  const loadData = async () => {
    // Only set loading if orders list is empty (first load of month)
    if (orders.length === 0) setLoading(true);
    try {
      const orderResult = await sheetService.getOrders(selectedMonth);
      setOrders(orderResult.orders);
      setCurrentFileId(orderResult.fileId); 
    } catch (e) {
      console.error(e);
      setOrders([]);
      setCurrentFileId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedMonth]);

  // --- HELPER SHOW MODAL ---
  const showMessage = (title: string, message: string, type: SystemModalState['type'] = 'alert', onConfirm?: () => void) => {
      setSysModal({ isOpen: true, title, message, type, onConfirm });
  };
  const closeMessage = () => setSysModal(prev => ({ ...prev, isOpen: false }));

  // --- Handlers cho Items trong Modal ---
  const handleAddItemRow = () => {
    // Mặc định đơn vị là Printway khi thêm dòng mới
    setFormItems([...formItems, { sku: '', type: 'Printway', quantity: 1, note: '' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return; // Giữ lại ít nhất 1 dòng
    const updatedItems = formItems.filter((_, i) => i !== index);
    setFormItems(updatedItems);
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const updatedItems = [...formItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormItems(updatedItems);
  };
  
  // Xử lý popup cảnh báo khi nhập ID trùng (Custom Modal, no alert)
  const handleIdBlur = () => {
      if (!isEditMode && formDataCommon.id) {
          const isDuplicate = orders.some(o => o.id.toLowerCase() === formDataCommon.id.trim().toLowerCase());
          if (isDuplicate) {
              showMessage('Cảnh báo trùng lặp', `Mã đơn hàng "${formDataCommon.id}" đã tồn tại trong danh sách!`, 'error');
          }
      }
  };
  
  // Xử lý tạo file tháng thủ công (Admin only)
  const handleCreateFile = async () => {
      showMessage(
          'Xác nhận tạo file', 
          `Bạn có chắc chắn muốn tạo file dữ liệu cho Tháng ${selectedMonth}?`, 
          'confirm',
          async () => {
              if (onProcessStart) onProcessStart();
              try {
                  const result = await sheetService.createMonthFile(selectedMonth);
                  if (result && result.success) {
                      showMessage('Thành công', `Đã tạo file cho tháng ${selectedMonth} thành công!`, 'success');
                      loadData();
                  } else {
                      const errorMsg = result?.error || "Lỗi không xác định. Vui lòng kiểm tra lại Deployment.";
                      showMessage('Lỗi', `Không thể tạo file: ${errorMsg}`, 'error');
                  }
              } catch (e) {
                  showMessage('Lỗi kết nối', 'Không thể kết nối đến server.', 'error');
              } finally {
                  if (onProcessEnd) onProcessEnd();
              }
          }
      );
  };
  
  // --- OPEN MODAL HANDLERS ---
  const openAddModal = () => {
      setIsEditMode(false);
      setEditingOrderId(null);
      setFormDataCommon({ 
          id: '', 
          date: new Date().toISOString().split('T')[0], 
          storeId: '' 
      });
      setFormDataExtra({
          tracking: '',
          link: '',
          status: 'Pending',
          actionRole: '',
          isChecked: false
      });
      // Mặc định unit là Printway
      setFormItems([{ sku: '', type: 'Printway', quantity: 1, note: '' }]);
      setIsModalOpen(true);
  };

  const openEditModal = (order: Order) => {
      // Prevent opening edit if already updating
      if (updatingOrderIds.has(order.id)) return;

      setIsEditMode(true);
      setEditingOrderId(order.id);
      
      // Populate Form
      setFormDataCommon({
          id: order.id,
          date: order.date,
          storeId: order.storeId 
      });
      
      setFormDataExtra({
          tracking: order.tracking || '',
          link: order.link || '',
          status: order.status || 'Pending',
          actionRole: order.actionRole || '',
          isChecked: order.isChecked || false
      });

      // Populate Items (Edit mode focuses on the Single Row selected)
      setFormItems([{
          sku: order.sku,
          type: order.type || '',
          quantity: order.quantity || 1,
          note: order.note || ''
      }]);

      setIsModalOpen(true);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDataCommon.id || !formDataCommon.storeId) return showMessage('Thiếu thông tin', 'Vui lòng nhập ID và chọn Store.', 'error');

    // Lọc bỏ các dòng không có SKU
    const validItems = formItems.filter(item => item.sku.trim() !== '');
    if (validItems.length === 0) return showMessage('Thiếu sản phẩm', "Vui lòng nhập ít nhất 1 sản phẩm (SKU).", 'error');

    const selectedStore = stores.find(s => s.id === formDataCommon.storeId);
    const storeValue = selectedStore ? selectedStore.name : formDataCommon.storeId;

    if (isEditMode) {
        // --- EDIT MODE ---
        const itemToUpdate = validItems[0];
        const updateData = {
            type: itemToUpdate.type,
            sku: itemToUpdate.sku,
            quantity: itemToUpdate.quantity,
            note: itemToUpdate.note,
            tracking: formDataExtra.tracking,
            link: formDataExtra.link,
            status: formDataExtra.status,
            actionRole: formDataExtra.actionRole,
            isChecked: formDataExtra.isChecked
        };
        const orderIdToUpdate = editingOrderId!;

        setIsModalOpen(false);
        setUpdatingOrderIds(prev => new Set(prev).add(orderIdToUpdate));
        if (onProcessStart) onProcessStart();

        try {
            if (currentFileId) {
                await sheetService.updateOrderBatch(currentFileId, orderIdToUpdate, updateData);
                await loadData();
            }
        } catch (error) {
            console.error("Update failed", error);
            showMessage('Lỗi cập nhật', `Không thể cập nhật đơn ${orderIdToUpdate}.`, 'error');
        } finally {
            setUpdatingOrderIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderIdToUpdate);
                return newSet;
            });
            if (onProcessEnd) onProcessEnd();
        }

    } else {
        // --- ADD MODE: HYBRID LOGIC (BLOCKING vs OPTIMISTIC) ---
        const orderIdToAdd = formDataCommon.id.trim();
        const orderMonth = formDataCommon.date.substring(0, 7); // YYYY-MM
        
        const newOrder: Order = {
            id: orderIdToAdd,
            date: formDataCommon.date,
            storeId: storeValue,
            items: validItems, 
            handler: user?.username || 'Unknown',
            sku: validItems[0].sku,
            type: validItems[0].type,
            quantity: validItems[0].quantity,
            note: validItems[0].note,
            status: formDataExtra.status,
            tracking: formDataExtra.tracking,
            link: formDataExtra.link,
            isChecked: formDataExtra.isChecked,
            actionRole: formDataExtra.actionRole
        };

        const needsFileCreation = !currentFileId || (orderMonth !== selectedMonth);

        if (needsFileCreation) {
             // === BLOCKING MODE ===
             setIsSubmitting(true);
             if (onProcessStart) onProcessStart();

             try {
                 await sheetService.addOrder(newOrder);
                 setIsModalOpen(false);
                 setIsSubmitting(false);
                 showMessage('Thành công', `Đã tạo đơn ${orderIdToAdd} và file dữ liệu mới.`, 'success');
                 
                 if (orderMonth === selectedMonth) {
                     await loadData();
                 }
             } catch (error: any) {
                 setIsSubmitting(false);
                 let msg = error.message || "Không thể tạo file mới.";
                 // Detect common Google Apps Script errors for deleted files
                 if (msg.includes("Document") && (msg.includes("is missing") || msg.includes("deleted"))) {
                     msg = "File Google Sheet của tháng này đã bị xóa trên Drive. Vui lòng thử lại, hệ thống sẽ tự động tạo file mới.";
                 }
                 showMessage('Lỗi tạo đơn', msg, 'error');
             } finally {
                 if (onProcessEnd) onProcessEnd();
             }

        } else {
            // === OPTIMISTIC MODE ===
            if (orders.some(o => o.id.toLowerCase() === orderIdToAdd.toLowerCase())) {
                showMessage('Trùng lặp', `Mã đơn hàng ${orderIdToAdd} đã tồn tại!`, 'error');
                return;
            }

            setIsModalOpen(false);
            setOrders(prev => [newOrder, ...prev]);
            setUpdatingOrderIds(prev => new Set(prev).add(orderIdToAdd));
            if (onProcessStart) onProcessStart();

            sheetService.addOrder(newOrder)
                .then(() => {
                     console.log(`Đã đồng bộ đơn hàng ${orderIdToAdd}.`);
                })
                .catch((error) => {
                    console.error("Add order failed", error);
                    let msg = error.message || "Không thể đồng bộ đơn hàng.";
                    if (msg.includes("Document") && (msg.includes("is missing") || msg.includes("deleted"))) {
                         msg = "File dữ liệu tháng này đã bị xóa. Vui lòng thử lại để hệ thống tự tạo mới.";
                    }
                    showMessage('Lỗi lưu đơn', `${msg} Đã hoàn tác trên giao diện.`, 'error');
                    setOrders(prev => prev.filter(o => o.id !== orderIdToAdd));
                })
                .finally(() => {
                    setUpdatingOrderIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(orderIdToAdd);
                        return newSet;
                    });
                    if (onProcessEnd) onProcessEnd();
                });
        }
    }
  };

  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      await sheetService.addUnit(newUnitName.trim());
      const updatedUnits = await sheetService.getUnits();
      setUnits(updatedUnits);
      if (formItems.length > 0) {
          handleItemChange(0, 'type', newUnitName.trim());
      }
      setIsAddingUnit(false);
      setNewUnitName('');
    } catch (error) {
      showMessage('Lỗi', "Lỗi khi thêm Đơn vị", 'error');
    }
  };

  const getStoreName = (id: string) => {
      const store = stores.find(s => String(s.id) === String(id) || s.name === id);
      return store ? store.name : id;
  };

  const getStatusColorClass = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'fulfilled' || s === 'completed') return 'text-green-700 bg-green-50 border-green-200';
    if (s === 'pending' || s === 'processing') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    if (s === 'cancelled') return 'text-red-700 bg-red-50 border-red-200';
    if (s === 'refund') return 'text-purple-700 bg-purple-50 border-purple-200';
    if (s === 'resend') return 'text-blue-700 bg-blue-50 border-blue-200';
    return 'text-gray-700 bg-gray-50 border-gray-200';
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const [y, m, d] = dateStr.split('-');
        if (y && m && d) return `${d}/${m}/${y}`;
        return dateStr;
    } catch (e) { return dateStr; }
  };

  const handleMonthChange = (step: number) => {
    try {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + step, 1);
        const newYear = date.getFullYear();
        const newMonth = String(date.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${newYear}-${newMonth}`);
    } catch (e) {
        console.error("Invalid date", e);
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || 
    (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
    (o.tracking ? String(o.tracking).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
    (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
    (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase())
  );

  const sortedOrders = filteredOrders
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
        if (sortConfig.key === 'date') {
            const dateA = new Date(a.item.date || '').getTime();
            const dateB = new Date(b.item.date || '').getTime();
            
            const validA = !isNaN(dateA);
            const validB = !isNaN(dateB);
            if (!validA && !validB) return 0;
            if (!validA) return 1;
            if (!validB) return -1;

            if (dateA !== dateB) {
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return a.index - b.index;
        }
        return 0;
    })
    .map(x => x.item);

  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');

  // Dark Input Classes for Modal
  const darkInputClass = "w-full border border-gray-600 rounded-md px-3 py-2 text-white bg-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 text-sm";
  const darkSelectClass = "w-full border border-gray-600 rounded-md px-3 py-2 text-white bg-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm appearance-none";

  // --- LOGIC PHÂN QUYỀN HIỂN THỊ USER ---
  const currentUserLevel = getRoleLevel(user?.role || '');
  const assignableUsers = allUsers.filter(u => getRoleLevel(u.role) >= currentUserLevel);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="bg-white shadow-sm overflow-hidden rounded-lg flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white z-20">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap flex items-center gap-2">
                DANH SÁCH ĐƠN HÀNG
                <button onClick={loadData} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Làm mới">
                    <RefreshCw size={16} className={loading && orders.length === 0 ? "animate-spin" : ""} />
                </button>
            </h2>
            
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm p-1">
                    <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center px-2 border-l border-r border-gray-100 gap-1 min-w-[160px] justify-center">
                        <Calendar size={14} className="text-orange-500 mr-1" />
                        <select value={currentMonthStr} onChange={(e) => setSelectedMonth(`${currentYearStr}-${e.target.value}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-center text-sm">
                            {monthsList.map(m => (<option key={m} value={m}>Tháng {parseInt(m)}</option>))}
                        </select>
                        <span className="text-gray-400">/</span>
                        <select value={currentYearStr} onChange={(e) => setSelectedMonth(`${e.target.value}-${currentMonthStr}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-sm">
                            {yearsList.map(y => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>
                    <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
                        <ChevronRight size={18} />
                    </button>
                </div>
                
                {currentFileId ? (
                    <a href={`https://docs.google.com/spreadsheets/d/${currentFileId}/edit`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors shadow-sm text-sm font-medium h-[42px]">
                        <FileSpreadsheet size={18} /> <span className="hidden sm:inline">Mở Sheet</span>
                    </a>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="h-[42px] px-3 flex items-center justify-center bg-gray-50 text-gray-400 border border-gray-200 rounded-lg text-xs italic">No File</div>
                        {user?.role === 'admin' && (
                             <button 
                                onClick={handleCreateFile}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm text-sm font-medium h-[42px]"
                                title="Admin: Tạo file cho tháng này"
                             >
                                <FolderPlus size={18} /> 
                                <span className="hidden sm:inline">Tạo File</span>
                             </button>
                        )}
                    </div>
                )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
             <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Tìm ID, SKU, Tracking, User..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-[#1a4019] focus:border-transparent outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
             <button onClick={openAddModal} className="flex items-center justify-center gap-2 bg-[#1a4019] hover:bg-[#143013] text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-md whitespace-nowrap">
                <Plus size={18} /> <span>Thêm Đơn</span>
             </button>
          </div>
        </div>

        {/* Table Container - Fixed Height for Sticky Header */}
        <div className="overflow-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm relative">
            <thead className="text-white font-bold text-center uppercase text-xs tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-3 py-3 border-r border-gray-600 cursor-pointer hover:bg-[#235221] sticky top-0 bg-[#1a4019] z-20" onClick={() => setSortConfig({ key: 'date', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                    <div className="flex items-center justify-center gap-1">Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>)}</div>
                </th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20">ID Order Etsy</th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20">STORE</th>
                <th className="px-3 py-3 border-r border-gray-600 w-24 sticky top-0 bg-[#1a4019] z-20">Đơn vị</th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20">SKU</th>
                <th className="px-3 py-3 border-r border-gray-600 w-16 sticky top-0 bg-[#1a4019] z-20">Qty</th>
                <th className="px-3 py-3 border-r border-gray-600 w-32 sticky top-0 bg-[#1a4019] z-20">Tracking</th>
                <th className="px-1 py-3 border-r border-gray-600 w-10 sticky top-0 bg-[#1a4019] z-20">Chk</th>
                <th className="px-3 py-3 border-r border-gray-600 w-32 sticky top-0 bg-[#1a4019] z-20">Link Tracking</th>
                <th className="px-3 py-3 border-r border-gray-600 w-32 sticky top-0 bg-[#1a4019] z-20">Trạng Thái</th>
                <th className="px-3 py-3 bg-yellow-400 text-black border-l border-gray-600 min-w-[150px] sticky top-0 z-20">Note</th>
                <th className="px-3 py-3 border-l border-gray-600 w-32 sticky top-0 bg-[#1a4019] z-20">Người xử lý</th>
                <th className="px-3 py-3 border-l border-gray-600 w-36 sticky top-0 bg-[#1a4019] z-20">Action Role</th>
                <th className="px-3 py-3 border-l border-gray-600 w-16 sticky top-0 bg-[#1a4019] z-20 text-center">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && orders.length === 0 ? 
                <tr><td colSpan={14} className="text-center py-12 text-gray-500">Đang tải dữ liệu tháng {selectedMonth}...</td></tr> : 
                (sortedOrders.length === 0 ? 
                    <tr><td colSpan={14} className="text-center py-12 text-gray-500">Tháng {selectedMonth} chưa có đơn hàng nào.</td></tr> :
                    sortedOrders.map((order, idx) => (
                        <tr key={order.id + idx} className="hover:bg-gray-50 border-b border-gray-200 text-gray-800 transition-colors">
                            <td className="px-2 py-3 border-r text-center whitespace-nowrap text-gray-600">{formatDateDisplay(order.date)}</td>
                            <td className="px-3 py-3 border-r font-semibold text-gray-900 whitespace-nowrap">
                                <div className="flex justify-between items-center group gap-2">
                                    <span>{order.id}</span>
                                    <button className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(order.id)} title="Copy ID">
                                        <Copy size={12} />
                                    </button>
                                </div>
                            </td>
                            <td className="px-3 py-3 border-r text-gray-700">{getStoreName(order.storeId)}</td>
                            
                            <td className="px-1 py-1 border-r text-center">
                                {order.type}
                            </td>
                            <td className="px-1 py-1 border-r font-mono text-xs text-gray-600 pl-2">
                                {order.sku}
                            </td>
                            <td className="px-1 py-1 border-r text-center font-bold">
                                {order.quantity}
                            </td>
                            <td className="px-1 py-1 border-r text-center text-xs text-gray-600">
                                {order.tracking || '...'}
                            </td>
                            
                            <td className="px-1 py-1 border-r text-center align-middle">
                                {order.isChecked ? <CheckSquare size={18} className="text-green-600 inline" /> : <Square size={18} className="text-gray-300 inline" />}
                            </td>

                            <td className="px-1 py-1 border-r text-center relative group">
                                {order.link && (
                                    <a href={order.link} target="_blank" className="text-blue-600 hover:underline text-xs flex items-center justify-center gap-1">
                                        Link <ExternalLink size={12} />
                                    </a>
                                )}
                            </td>
                            <td className="px-1 py-1 border-r text-center">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColorClass(order.status as string).replace('bg-white', '').replace('text-gray-700', '')}`}>
                                    {order.status}
                                </span>
                            </td>
                            <td className="px-2 py-2 bg-yellow-50 border-l relative h-full text-xs text-gray-700">
                                {order.note}
                            </td>
                            <td className="px-2 py-3 border-l text-center text-xs text-gray-600 font-medium whitespace-nowrap bg-gray-50/50">
                                <div className="flex items-center justify-center gap-1.5">
                                    <UserCircle size={14} className="text-gray-400"/>
                                    {order.handler || user?.username}
                                </div>
                            </td>
                            
                            <td className="px-1 py-1 border-l text-center bg-gray-50/30 text-xs font-bold text-orange-600">
                                {order.actionRole || '-'}
                            </td>

                            {/* EDIT BUTTON or LOADING SPINNER */}
                            <td className="px-1 py-1 border-l text-center">
                                {updatingOrderIds.has(order.id) ? (
                                    <div className="flex justify-center items-center h-full">
                                        <Loader2 size={16} className="animate-spin text-orange-500" />
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => openEditModal(order)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                        title="Chỉnh sửa đơn hàng"
                                    >
                                        <Edit size={16} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))
                )
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* --- SYSTEM MESSAGE MODAL (REPLACEMENT FOR ALERT/PROMPT) --- */}
      {sysModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden scale-100 transform transition-all">
                  <div className="p-4 flex gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          sysModal.type === 'error' ? 'bg-red-100 text-red-600' :
                          sysModal.type === 'success' ? 'bg-green-100 text-green-600' :
                          sysModal.type === 'confirm' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                          {sysModal.type === 'error' && <AlertTriangle size={20} />}
                          {sysModal.type === 'success' && <CheckSquare size={20} />}
                          {sysModal.type === 'confirm' && <Info size={20} />}
                          {sysModal.type === 'alert' && <Info size={20} />}
                      </div>
                      <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{sysModal.title}</h3>
                          <p className="text-sm text-gray-600">{sysModal.message}</p>
                      </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
                      {sysModal.type === 'confirm' ? (
                          <>
                              <button onClick={closeMessage} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded">Hủy bỏ</button>
                              <button 
                                  onClick={() => { closeMessage(); if(sysModal.onConfirm) sysModal.onConfirm(); }} 
                                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                              >
                                  Xác nhận
                              </button>
                          </>
                      ) : (
                          <button onClick={closeMessage} className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium">Đóng</button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL TẠO / SỬA ĐƠN HÀNG (DARK MODE & MULTI SKU) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#1e293b]">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        {isEditMode ? <Edit className="text-orange-500" size={24} /> : <Plus className="text-orange-500" size={24} />}
                        {isEditMode ? 'CHỈNH SỬA ĐƠN HÀNG' : 'TẠO ĐƠN HÀNG MỚI'}
                    </h3>
                    {!isSubmitting && (
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1 rounded-full">✕</button>
                    )}
                </div>
                
                <form onSubmit={handleSubmitOrder} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                        {/* 1. THÔNG TIN CHUNG */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-gray-200">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày Đặt <span className="text-red-500">*</span></label>
                                <input 
                                    type="date" 
                                    required 
                                    className={`${darkInputClass} ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`} 
                                    value={formDataCommon.date} 
                                    onChange={(e) => setFormDataCommon({...formDataCommon, date: e.target.value})}
                                    readOnly={isEditMode}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mã Đơn (ID) <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    required 
                                    className={`${darkInputClass} ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`} 
                                    placeholder="ORD-..." 
                                    value={formDataCommon.id} 
                                    onChange={(e) => setFormDataCommon({...formDataCommon, id: e.target.value})}
                                    onBlur={handleIdBlur} 
                                    readOnly={isEditMode}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cửa Hàng <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <select 
                                        required 
                                        className={`${darkSelectClass} ${isEditMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        value={formDataCommon.storeId} 
                                        onChange={(e) => setFormDataCommon({...formDataCommon, storeId: e.target.value})}
                                        disabled={isEditMode}
                                    >
                                        <option value="" className="text-gray-400">-- Chọn Store --</option>
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <ArrowDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* 2. THÔNG TIN SẢN PHẨM */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase">
                                    {isEditMode ? 'Sản Phẩm (Đang chỉnh sửa dòng này)' : `Danh Sách Sản Phẩm (${formItems.length})`}
                                </label>
                                {!isEditMode && user?.role === 'admin' && (
                                    <button type="button" onClick={() => setIsAddingUnit(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                        <Plus size={12} className="mr-1" /> Thêm Unit
                                    </button>
                                )}
                            </div>

                            {/* ADD UNIT INLINE */}
                            {isAddingUnit && (
                                <div className="flex gap-2 mb-3 bg-blue-50 p-2 rounded border border-blue-100">
                                    <input type="text" className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500" placeholder="Tên đơn vị mới..." value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} autoFocus />
                                    <button type="button" onClick={handleAddUnit} className="bg-blue-600 text-white px-3 rounded text-xs font-bold hover:bg-blue-700">Lưu</button>
                                    <button type="button" onClick={() => setIsAddingUnit(false)} className="bg-gray-200 text-gray-600 px-2 rounded text-xs hover:bg-gray-300">✕</button>
                                </div>
                            )}

                            <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="px-3 py-2 w-12 text-center">#</th>
                                            <th className="px-3 py-2 w-32">Đơn vị (Type)</th>
                                            <th className="px-3 py-2">SKU Sản Phẩm <span className="text-red-500">*</span></th>
                                            <th className="px-3 py-2 w-20 text-center">SL</th>
                                            <th className="px-3 py-2">Ghi chú</th>
                                            <th className="px-3 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {formItems.map((item, index) => (
                                            <tr key={index} className="bg-white">
                                                <td className="px-3 py-2 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                                                <td className="px-2 py-2">
                                                    <select 
                                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                                                        value={item.type}
                                                        onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                                                    >
                                                        <option value="">-- Loại --</option>
                                                        {units.map((u, i) => <option key={i} value={u}>{u}</option>)}
                                                        {/* Đảm bảo có option Printway nếu trong list units chưa có */}
                                                        {!units.includes('Printway') && <option value="Printway">Printway</option>}
                                                        <option value="Khác">Khác</option>
                                                    </select>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input 
                                                        type="text" 
                                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:ring-1 focus:ring-orange-500 outline-none" 
                                                        placeholder="SKU..." 
                                                        value={item.sku}
                                                        onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input 
                                                        type="number" 
                                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-center font-bold focus:ring-1 focus:ring-orange-500 outline-none" 
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                        min="1"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input 
                                                        type="text" 
                                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-500 outline-none" 
                                                        placeholder="..." 
                                                        value={item.note}
                                                        onChange={(e) => handleItemChange(index, 'note', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    {!isEditMode && formItems.length > 1 && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleRemoveItemRow(index)}
                                                            className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {!isEditMode && (
                                    <button 
                                        type="button" 
                                        onClick={handleAddItemRow}
                                        className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-blue-600 text-xs font-bold uppercase tracking-wide transition-colors border-t border-gray-200"
                                    >
                                        + Thêm dòng sản phẩm
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 3. THÔNG TIN XỬ LÝ (Tracking, Status, Role, v.v.) */}
                        <div className="bg-slate-700 p-4 rounded-lg border border-gray-600">
                             <h4 className="text-white text-xs font-bold uppercase mb-3 flex items-center gap-2">
                                 <Calendar size={14} />
                                 Thông tin xử lý & Tracking
                             </h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                     <label className="block text-xs font-bold text-gray-400 mb-1">Tracking Number</label>
                                     <input 
                                        type="text" 
                                        className={darkInputClass} 
                                        placeholder="Mã vận đơn..."
                                        value={formDataExtra.tracking}
                                        onChange={(e) => setFormDataExtra({...formDataExtra, tracking: e.target.value})}
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-gray-400 mb-1">Link Tracking</label>
                                     <input 
                                        type="text" 
                                        className={darkInputClass} 
                                        placeholder="https://..."
                                        value={formDataExtra.link}
                                        onChange={(e) => setFormDataExtra({...formDataExtra, link: e.target.value})}
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-gray-400 mb-1">Trạng Thái Đơn</label>
                                     <select 
                                        className={darkSelectClass}
                                        value={formDataExtra.status}
                                        onChange={(e) => setFormDataExtra({...formDataExtra, status: e.target.value})}
                                     >
                                         <option value="Pending">Pending</option>
                                         <option value="Fulfilled">Fulfilled</option>
                                         <option value="Cancelled">Cancelled</option>
                                         <option value="Resend">Resend</option>
                                         <option value="Refund">Refund</option>
                                     </select>
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-gray-400 mb-1">Giao Việc (Role Action)</label>
                                     <select 
                                        className={darkSelectClass}
                                        value={formDataExtra.actionRole}
                                        onChange={(e) => setFormDataExtra({...formDataExtra, actionRole: e.target.value})}
                                     >
                                        <option value="">-- Assign User --</option>
                                        {assignableUsers.map(u => (
                                            <option key={u.username} value={u.username}>
                                                {u.username} ({u.role})
                                            </option>
                                        ))}
                                     </select>
                                 </div>
                                 <div className="md:col-span-2 flex items-center gap-3 pt-2">
                                     <button 
                                        type="button"
                                        onClick={() => setFormDataExtra({...formDataExtra, isChecked: !formDataExtra.isChecked})}
                                        className="flex items-center gap-2 text-white hover:text-orange-400 transition-colors"
                                     >
                                         {formDataExtra.isChecked ? <CheckSquare className="text-green-500" /> : <Square className="text-gray-400" />}
                                         <span className="text-sm font-medium">Đánh dấu đã kiểm tra (Check)</span>
                                     </button>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                        <button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm">Hủy bỏ</button>
                        <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70">
                            {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20} />}
                            {isSubmitting ? 'Đang tạo file & đơn...' : (isEditMode ? 'Lưu Thay Đổi' : 'Tạo Đơn Hàng')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;
