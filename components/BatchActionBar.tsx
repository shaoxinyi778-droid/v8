import React from 'react';

interface BatchActionBarProps {
  isVisible: boolean;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  isVisible,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onDownload,
  onDelete,
  onClose
}) => {
  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transform transition-transform duration-300 flex items-center justify-between z-40 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <div className="flex items-center gap-4 px-4">
        <span className="font-bold text-indigo-600 text-lg">已选 {selectedCount} 项</span>
        <span className="text-gray-400 text-sm">|</span>
        <button onClick={onSelectAll} className="text-gray-600 hover:text-gray-800 text-sm font-medium">全选</button>
        <button onClick={onDeselectAll} className="text-gray-600 hover:text-gray-800 text-sm font-medium">取消全选</button>
      </div>
      <div className="flex items-center gap-3 px-4">
        <button onClick={onDownload} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <i className="fa-solid fa-download"></i> 批量下载
        </button>
        <button onClick={onDelete} className="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <i className="fa-regular fa-trash-can"></i> 批量删除
        </button>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 px-3">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>
    </div>
  );
};