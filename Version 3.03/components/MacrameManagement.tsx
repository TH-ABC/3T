
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Filter, Download, Trash2, Edit2, 
  ExternalLink, Loader2, AlertCircle, CheckCircle2, X,
  ShoppingCart, Landmark, FileText, Truck, Save, PlusCircle, MinusCircle, Copy,
  CreditCard, History, Image as ImageIcon, Link as LinkIcon, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MacrameProduct, User, MacramePayment } from '../types';

interface MacrameManagementProps {
  user: User;
}

interface MacrameItemForm {
  sku: string;
  quantity: number;
  product_name: string;
  etsy_link: string;
  size: string;
  color: string;
  unit_price: number;
  total_amount: number;
  shipping_cost: number;
  packaging_size: string;
  note: string;
  label_link: string;
}

const MacrameManagement: React.FC<MacrameManagementProps> = ({ user }) => {
  const [products, setProducts] = useState<MacrameProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [totalShippingCost, setTotalShippingCost] = useState<number>(0);
  const [editingProduct, setEditingProduct] = useState<MacrameProduct | null>(null);
  const [viewingProduct, setViewingProduct] = useState<MacrameProduct | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Payment state
  const [payments, setPayments] = useState<MacramePayment[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentImage, setPaymentImage] = useState<string | null>(null);
  const [paymentImageLink, setPaymentImageLink] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const canEditFull = user.role === 'admin' || user.permissions?.macrame === 'all';
  const canEditLimited = user.permissions?.macrame === 'own';
  const canView = user.role === 'admin' || user.permissions?.macrame !== 'none';

  useEffect(() => {
    if (canView) {
      fetchProducts();
      fetchPayments();
    }
  }, [canView]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('vi-VN');
  };

  // Form state for multi-item
  const [orderId, setOrderId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<MacrameItemForm[]>([{
    sku: '',
    quantity: 1,
    product_name: '',
    etsy_link: '',
    size: '',
    color: '',
    unit_price: 0,
    total_amount: 0,
    shipping_cost: 0,
    packaging_size: '',
    note: '',
    label_link: ''
  }]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('macrame_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error('Error fetching macrame products:', err);
      setError('Không thể tải dữ liệu Macrame.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('macrame_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      console.error('Error fetching macrame payments:', err);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      alert('Vui lòng nhập số tiền thanh toán.');
      return;
    }

    setIsSubmittingPayment(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('macrame_payments')
        .insert({
          amount: paymentAmount,
          payment_date: paymentDate,
          image_url: paymentImage,
          image_link: paymentImageLink,
          created_by: user.username
        });

      if (insertError) throw insertError;

      setSuccess('Thanh toán thành công!');
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentImage(null);
      setPaymentImageLink('');
      fetchPayments();
    } catch (err: any) {
      console.error('Error submitting payment:', err);
      setError(`Có lỗi xảy ra khi thanh toán: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setPaymentImage(event.target?.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.indexOf('image') !== -1) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPaymentImage(event.target?.result as string);
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleAddItem = () => {
    setItems([...items, {
      sku: '',
      quantity: 1,
      product_name: '',
      etsy_link: '',
      size: '',
      color: '',
      unit_price: 0,
      total_amount: 0,
      shipping_cost: 0,
      packaging_size: '',
      note: '',
      label_link: ''
    }]);
  };

  const handleDuplicateItem = (index: number) => {
    const itemToDuplicate = { ...items[index] };
    setItems([...items, itemToDuplicate]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof MacrameItemForm, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'unit_price' || field === 'quantity') {
      item.total_amount = (item.unit_price || 0) * (item.quantity || 0);
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  const handleEdit = (product: MacrameProduct) => {
    setEditingProduct(product);
    setOrderId(product.order_id);
    setOrderDate(product.order_date);
    setItems([{
      sku: product.sku,
      quantity: product.quantity,
      product_name: product.product_name,
      etsy_link: product.etsy_link,
      size: product.size,
      color: product.color,
      unit_price: product.unit_price,
      total_amount: product.total_amount,
      shipping_cost: product.shipping_cost || 0,
      packaging_size: product.packaging_size,
      note: product.note,
      label_link: product.label_link
    }]);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingProduct) {
        // Update single product
        const item = items[0];
        const { error } = await supabase
          .from('macrame_products')
          .update({
            order_id: orderId,
            order_date: orderDate,
            ...item
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        setSuccess('Cập nhật sản phẩm thành công!');
      } else {
        // Insert multiple products
        const productsToInsert = items.map(item => ({
          order_id: orderId,
          order_date: orderDate,
          ...item,
          created_by: user.username
        }));

        const { error } = await supabase
          .from('macrame_products')
          .insert(productsToInsert);

        if (error) throw error;
        setSuccess('Thêm sản phẩm thành công!');
      }

      setIsModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError(err.message || 'Có lỗi xảy ra khi lưu dữ liệu.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setOrderId('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setItems([{
      sku: '',
      quantity: 1,
      product_name: '',
      etsy_link: '',
      size: '',
      color: '',
      unit_price: 0,
      total_amount: 0,
      shipping_cost: 0,
      packaging_size: '',
      note: '',
      label_link: ''
    }]);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    
    setIsDeleting(true);
    setError(null);
    try {
      console.log('Attempting to delete product with ID:', deletingId);
      const { error: deleteError } = await supabase
        .from('macrame_products')
        .delete()
        .eq('id', deletingId);

      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        throw deleteError;
      }

      console.log('Product deleted successfully from database');
      setProducts(prev => prev.filter(p => p.id !== deletingId));
      setDeletingId(null);
      setSuccess('Đã xóa sản phẩm thành công.');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error in handleDelete:', err);
      setError(`Không thể xóa sản phẩm: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product && product.shipping_cost && Number(product.shipping_cost) > 0) {
      return; // Block selection if already has shipping cost
    }
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const selectableProducts = filteredProducts.filter(p => !p.shipping_cost || Number(p.shipping_cost) === 0);
    if (selectedIds.length === selectableProducts.length && selectableProducts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableProducts.map(p => p.id));
    }
  };

  const handleApplyShipping = async () => {
    if (selectedIds.length === 0) return;
    if (totalShippingCost <= 0) {
      alert('Vui lòng nhập tổng tiền ship.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      console.log('Applying shipping cost:', totalShippingCost, 'to', selectedIds.length, 'orders');
      const costPerOrder = totalShippingCost / selectedIds.length;
      
      const { error: updateError } = await supabase
        .from('macrame_products')
        .update({ shipping_cost: costPerOrder })
        .in('id', selectedIds);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw updateError;
      }

      setSuccess(`Đã chia đều ${totalShippingCost.toLocaleString('vi-VN')} VNĐ cho ${selectedIds.length} đơn hàng.`);
      setIsShippingModalOpen(false);
      setSelectedIds([]);
      setTotalShippingCost(0);
      fetchProducts();
    } catch (err: any) {
      console.error('Error applying shipping:', err);
      setError(`Có lỗi xảy ra khi cập nhật tiền ship: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate order groups for highlighting
  const orderGroups = useMemo(() => {
    const groups: { [key: string]: { bg: string, dot: string } } = {};
    const orderCounts: { [key: string]: number } = {};
    
    // Count occurrences of each order_id
    filteredProducts.forEach(p => {
      orderCounts[p.order_id] = (orderCounts[p.order_id] || 0) + 1;
    });

    const colorPalette = [
      { bg: 'bg-blue-50/50', dot: 'bg-blue-400' },
      { bg: 'bg-purple-50/50', dot: 'bg-purple-400' },
      { bg: 'bg-pink-50/50', dot: 'bg-pink-400' },
      { bg: 'bg-indigo-50/50', dot: 'bg-indigo-400' },
      { bg: 'bg-cyan-50/50', dot: 'bg-cyan-400' },
      { bg: 'bg-teal-50/50', dot: 'bg-teal-400' },
      { bg: 'bg-rose-50/50', dot: 'bg-rose-400' },
      { bg: 'bg-amber-50/50', dot: 'bg-amber-400' },
      { bg: 'bg-emerald-50/50', dot: 'bg-emerald-400' },
      { bg: 'bg-violet-50/50', dot: 'bg-violet-400' },
    ];

    let colorIndex = 0;
    // Sort order IDs to keep colors consistent
    const sortedOrderIds = Object.keys(orderCounts).sort();
    
    sortedOrderIds.forEach(orderId => {
      if (orderCounts[orderId] > 1) {
        groups[orderId] = colorPalette[colorIndex % colorPalette.length];
        colorIndex++;
      }
    });

    return groups;
  }, [filteredProducts]);

  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
            Nghiệp vụ Macrame
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Quản lý sản phẩm Macrame & Đơn hàng</p>
        </div>
        
        <div className="flex items-center gap-2">
          {canEditFull && (
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95"
            >
              <CreditCard size={18} />
              Thanh toán
            </button>
          )}
          {(canEditFull || canEditLimited) && selectedIds.length > 0 && (
            <button 
              onClick={() => setIsShippingModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <Truck size={18} />
              Gộp Ship ({selectedIds.length})
            </button>
          )}
          {canEditFull && (
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-200 active:scale-95"
            >
              <Plus size={18} />
              Thêm sản phẩm
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 animate-shake">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center gap-3 animate-slide-in">
          <CheckCircle2 size={20} />
          <p className="text-sm font-bold">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto p-1 hover:bg-emerald-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats/Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <ShoppingCart size={24} />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng đơn hàng</div>
            <div className="text-xl font-black text-slate-800">{products.length}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <Landmark size={24} />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tiền hàng</div>
            <div className="text-xl font-black text-slate-800">
              {products.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0).toLocaleString()} VNĐ
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Truck size={24} />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Ship</div>
            <div className="text-xl font-black text-slate-800">
              {products.reduce((sum, p) => sum + (Number(p.shipping_cost) || 0), 0).toLocaleString()} VNĐ
            </div>
          </div>
        </div>
        <div 
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setIsPaymentHistoryOpen(true)}
        >
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
            <CreditCard size={24} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thanh Toán / Còn nợ</div>
            <div className="flex items-baseline gap-2">
              <div className="text-lg font-black text-emerald-600">
                {payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs font-bold text-slate-400">/</div>
              <div className="text-lg font-black text-red-600">
                {(
                  products.reduce((sum, p) => sum + (Number(p.total_amount) || 0) + (Number(p.shipping_cost) || 0), 0) - 
                  payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                ).toLocaleString()}
              </div>
            </div>
          </div>
          <History size={18} className="text-slate-300" />
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center px-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm ID Order, SKU, Tên SP..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-500 transition-all"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={
                      filteredProducts.filter(p => !p.shipping_cost || Number(p.shipping_cost) === 0).length > 0 &&
                      selectedIds.length === filteredProducts.filter(p => !p.shipping_cost || Number(p.shipping_cost) === 0).length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày đặt</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Order</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sản phẩm / SKU</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">SL</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kích thước / Màu</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thành tiền</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ship</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Label</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Links</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <Loader2 className="mx-auto animate-spin text-orange-500 mb-2" size={32} />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search size={32} className="text-slate-300" />
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Không tìm thấy sản phẩm nào</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    onClick={() => setViewingProduct(product)}
                    className={`hover:bg-slate-50/50 transition-colors group cursor-pointer 
                      ${selectedIds.includes(product.id) ? 'bg-orange-50/30' : (orderGroups[product.order_id]?.bg || '')} 
                      ${product.shipping_cost && Number(product.shipping_cost) > 0 ? 'opacity-70' : ''}`}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(product.id)}
                        onChange={() => handleToggleSelect(product.id)}
                        disabled={product.shipping_cost && Number(product.shipping_cost) > 0}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-black text-slate-600">{product.order_date}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {orderGroups[product.order_id] && (
                          <div className={`w-2 h-2 rounded-full ${orderGroups[product.order_id].dot} animate-pulse`} />
                        )}
                        <div className="text-xs font-black text-orange-600">#{product.order_id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-black text-slate-800 truncate max-w-[200px]">{product.product_name}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{product.sku}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black">{product.quantity}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-[10px] font-bold text-slate-600">Size: {product.size || '---'}</div>
                      <div className="text-[10px] font-bold text-slate-600">Color: {product.color || '---'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-black text-emerald-600">{formatCurrency(Number(product.total_amount))} VNĐ</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Đơn giá: {formatCurrency(Number(product.unit_price))} VNĐ</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-black text-blue-600">{product.shipping_cost ? `${formatCurrency(Number(product.shipping_cost))} VNĐ` : '---'}</div>
                      {product.shipping_cost && Number(product.shipping_cost) > 0 && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded uppercase">Hoàn tất</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-[10px] font-bold text-slate-500 whitespace-pre-wrap" title={product.note}>{product.note || '---'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {product.label_link && (
                          <a href={product.label_link} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Label Link">
                            <FileText size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {product.etsy_link && (
                          <a href={product.etsy_link} target="_blank" rel="noreferrer" className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors" title="Etsy Link">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(canEditFull || canEditLimited) && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(product);
                              }} 
                              className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Edit2 size={16} />
                            </button>
                            {canEditFull && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Delete button clicked for product:', product.id);
                                  setDeletingId(product.id);
                                }} 
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                title="Xóa sản phẩm"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-in flex flex-col max-h-[90vh] border border-slate-800">
            <div className="bg-slate-800/50 px-8 py-6 flex justify-between items-center border-b border-slate-800">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm Macrame'}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {editingProduct ? 'Cập nhật thông tin sản phẩm' : 'Nhập thông tin chi tiết đơn hàng (có thể nhập nhiều item)'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* ID Order */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Order *</label>
                  <input 
                    required
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 focus:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all outline-none"
                    placeholder="VD: 123456789"
                  />
                </div>

                {/* Ngày đặt hàng */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày đặt hàng</label>
                  <input 
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 focus:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-8">
                {items.map((item, index) => (
                  <div key={index} className="p-6 bg-slate-800/30 rounded-[2rem] border-2 border-slate-800 relative">
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Item #{index + 1}
                    </div>

                    <div className="absolute -top-3 right-6 flex gap-2">
                      {!editingProduct && (
                        <button 
                          type="button"
                          onClick={() => handleDuplicateItem(index)}
                          className="w-8 h-8 bg-slate-800 text-blue-400 rounded-full shadow-md flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-700"
                          title="Nhân bản item này"
                        >
                          <Copy size={16} />
                        </button>
                      )}
                      {!editingProduct && items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="w-8 h-8 bg-slate-800 text-red-500 rounded-full shadow-md flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-700"
                          title="Xóa item này"
                        >
                          <MinusCircle size={18} />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                      {/* Sản phẩm */}
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sản phẩm *</label>
                        <input 
                          required
                          value={item.product_name}
                          onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                          placeholder="Tên sản phẩm Macrame"
                        />
                      </div>

                      {/* SKU */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU</label>
                        <input 
                          value={item.sku}
                          onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                          placeholder="VD: MAC-001"
                        />
                      </div>

                      {/* Số lượng */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số lượng</label>
                        <input 
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                        />
                      </div>

                      {/* Kích thước */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kích thước</label>
                        <input 
                          value={item.size}
                          onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                          placeholder="VD: 30x50cm"
                        />
                      </div>

                      {/* Màu sắc */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Màu sắc</label>
                        <input 
                          value={item.color}
                          onChange={(e) => handleItemChange(index, 'color', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                          placeholder="VD: Trắng kem"
                        />
                      </div>

                      {/* Đơn giá */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn giá (VNĐ)</label>
                        <input 
                          type="number"
                          step="1000"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                          disabled={!canEditFull && !canEditLimited}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none disabled:opacity-50"
                        />
                      </div>

                      {/* Phí vận chuyển */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phí vận chuyển (VNĐ)</label>
                        <input 
                          type="number"
                          step="1000"
                          value={item.shipping_cost}
                          onChange={(e) => handleItemChange(index, 'shipping_cost', parseFloat(e.target.value))}
                          disabled={!canEditFull && !canEditLimited}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none disabled:opacity-50"
                        />
                      </div>

                      {/* Thành tiền */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thành tiền (VNĐ)</label>
                        <div className="w-full px-4 py-3 bg-slate-900 border-2 border-transparent rounded-2xl text-sm font-black text-emerald-400 outline-none flex items-center">
                          {formatCurrency(item.total_amount)}
                        </div>
                      </div>

                      {/* Kích thước đóng gói */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kích thước đóng gói</label>
                        <input 
                          value={item.packaging_size}
                          onChange={(e) => handleItemChange(index, 'packaging_size', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                          placeholder="VD: 10x10x5cm"
                        />
                      </div>

                      {/* Link Etsy */}
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link Etsy</label>
                        <input 
                          value={item.etsy_link}
                          onChange={(e) => handleItemChange(index, 'etsy_link', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                          placeholder="https://etsy.com/..."
                        />
                      </div>

                      {/* Link Label */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link Label</label>
                        <input 
                          value={item.label_link}
                          onChange={(e) => handleItemChange(index, 'label_link', e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none"
                          placeholder="Link file label"
                        />
                      </div>

                      {/* Note */}
                      <div className="md:col-span-3 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ghi chú</label>
                        <textarea 
                          value={item.note}
                          onChange={(e) => handleItemChange(index, 'note', e.target.value)}
                          rows={2}
                          className="w-full px-4 py-3 bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl text-sm font-bold text-white transition-all outline-none resize-none"
                          placeholder="Ghi chú thêm..."
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {!editingProduct && (
                  <button 
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-4 border-2 border-dashed border-slate-700 rounded-[2rem] text-slate-500 hover:text-orange-500 hover:border-orange-500 hover:bg-orange-500/5 transition-all flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest"
                  >
                    <PlusCircle size={20} />
                    Thêm item khác cho đơn hàng này
                  </button>
                )}
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-900/20 border border-red-900/50 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
            </form>

            <div className="p-8 bg-slate-800/50 border-t border-slate-800 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 border border-slate-700"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-[2] py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {submitting ? 'Đang lưu...' : (editingProduct ? 'Cập nhật' : 'Lưu tất cả')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Product Detail Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-in flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 px-8 py-6 flex justify-between items-center border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <ShoppingCart className="text-orange-500" size={24} />
                  Chi tiết đơn hàng #{viewingProduct.order_id}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thông tin đầy đủ sản phẩm Macrame</p>
              </div>
              <button onClick={() => setViewingProduct(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ngày đặt</div>
                  <div className="text-sm font-black text-slate-800">{viewingProduct.order_date}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SKU</div>
                  <div className="text-sm font-black text-slate-800">{viewingProduct.sku || '---'}</div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tên sản phẩm</div>
                <div className="text-sm font-black text-slate-800">{viewingProduct.product_name}</div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số lượng</div>
                  <div className="text-sm font-black text-slate-800">{viewingProduct.quantity}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kích thước</div>
                  <div className="text-sm font-black text-slate-800">{viewingProduct.size || '---'}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Màu sắc</div>
                  <div className="text-sm font-black text-slate-800">{viewingProduct.color || '---'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Đơn giá</div>
                  <div className="text-lg font-black text-emerald-700">{formatCurrency(viewingProduct.unit_price)} VNĐ</div>
                </div>
                <div className="p-4 bg-emerald-600 rounded-2xl border border-emerald-700 shadow-lg shadow-emerald-100">
                  <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1">Thành tiền</div>
                  <div className="text-lg font-black text-white">{formatCurrency(viewingProduct.total_amount)} VNĐ</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Phí vận chuyển</div>
                  <div className="text-sm font-black text-blue-800">{viewingProduct.shipping_cost ? `${formatCurrency(viewingProduct.shipping_cost)} VNĐ` : '---'}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kích thước đóng gói</div>
                  <div className="text-sm font-black text-slate-800">{viewingProduct.packaging_size || '---'}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Liên kết</div>
                <div className="flex gap-3">
                  {viewingProduct.etsy_link && (
                    <a 
                      href={viewingProduct.etsy_link} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-50 text-orange-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-all border border-orange-100"
                    >
                      <ExternalLink size={16} />
                      Link Etsy
                    </a>
                  )}
                  {viewingProduct.label_link && (
                    <a 
                      href={viewingProduct.label_link} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100"
                    >
                      <FileText size={16} />
                      Link Label
                    </a>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ghi chú</div>
                <div className="text-sm font-bold text-slate-600 whitespace-pre-wrap">{viewingProduct.note || 'Không có ghi chú.'}</div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Tạo bởi: {viewingProduct.created_by || '---'}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Lúc: {viewingProduct.created_at ? new Date(viewingProduct.created_at).toLocaleString('vi-VN') : '---'}</div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setViewingProduct(null)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-slide-in">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Xác nhận xóa</h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed">
                Bạn có chắc chắn muốn xóa sản phẩm này? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-slate-200 disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Modal */}
      {isShippingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-in">
            <div className="bg-slate-50 px-8 py-6 flex justify-between items-center border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Gộp phí vận chuyển</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chia đều tổng phí cho các đơn đã chọn</p>
              </div>
              <button onClick={() => setIsShippingModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Đã chọn</div>
                <div className="text-lg font-black text-blue-700">{selectedIds.length} đơn hàng</div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tổng phí vận chuyển (VNĐ)</label>
                <input 
                  type="text"
                  value={totalShippingCost === 0 ? '' : totalShippingCost.toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setTotalShippingCost(val ? parseInt(val, 10) : 0);
                  }}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl text-xl font-black transition-all outline-none"
                  placeholder="0"
                />
              </div>

              {totalShippingCost > 0 && (
                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mỗi đơn sẽ chịu</div>
                  <div className="text-lg font-black text-slate-800">{formatCurrency(totalShippingCost / selectedIds.length)} VNĐ</div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsShippingModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleApplyShipping}
                  disabled={submitting || totalShippingCost <= 0}
                  className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-in flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 px-8 py-6 flex justify-between items-center border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Thanh toán VNĐ</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nhập thông tin thanh toán cho đơn hàng Macrame</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Số tiền thanh toán (VNĐ) *</label>
                <input 
                  required
                  type="text"
                  value={paymentAmount === 0 ? '' : paymentAmount.toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPaymentAmount(val ? parseInt(val, 10) : 0);
                  }}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl text-2xl font-black text-emerald-600 transition-all outline-none"
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ngày thanh toán</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ảnh giao dịch (Kéo thả hoặc Dán)</label>
                <div 
                  onPaste={handleImagePaste}
                  onDrop={handleImageDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative ${paymentImage ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-emerald-300'}`}
                >
                  {paymentImage ? (
                    <>
                      <img src={paymentImage} alt="Transaction" className="w-full h-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setPaymentImage(null)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={48} className="text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kéo thả ảnh hoặc Ctrl + V để dán</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Link ảnh giao dịch</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    value={paymentImageLink}
                    onChange={(e) => setPaymentImageLink(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </form>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-4 bg-white hover:bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 border border-slate-200"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handlePaymentSubmit}
                disabled={isSubmittingPayment || paymentAmount <= 0}
                className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingPayment ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Xác nhận thanh toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {isPaymentHistoryOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-in flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 px-8 py-6 flex justify-between items-center border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Lịch sử thanh toán</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Danh sách các lần thanh toán đã thực hiện</p>
              </div>
              <button onClick={() => setIsPaymentHistoryOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {payments.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History size={32} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Chưa có giao dịch nào</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-800">{formatCurrency(Number(payment.amount))} VNĐ</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{payment.payment_date} • {payment.created_by}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {payment.image_url && (
                          <a href={payment.image_url} target="_blank" rel="noreferrer" className="p-2 bg-white text-slate-400 hover:text-emerald-600 rounded-lg shadow-sm border border-slate-100 transition-all">
                            <ImageIcon size={16} />
                          </a>
                        )}
                        {payment.image_link && (
                          <a href={payment.image_link} target="_blank" rel="noreferrer" className="p-2 bg-white text-slate-400 hover:text-blue-600 rounded-lg shadow-sm border border-slate-100 transition-all">
                            <LinkIcon size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setIsPaymentHistoryOpen(false)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MacrameManagement;
