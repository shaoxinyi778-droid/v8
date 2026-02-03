import React from 'react';
import { TopFilterState } from '../types';

interface TopBarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  topFilter: TopFilterState;
  onTopFilterChange: (key: keyof TopFilterState, value: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchTerm,
  onSearchChange,
  isSelectionMode,
  onToggleSelectionMode,
  topFilter,
  onTopFilterChange
}) => {

  const getBtnClass = (isActive: boolean) => 
    `px-3 py-1 rounded-md transition-all ${
      isActive 
        ? 'bg-white shadow-sm font-medium text-gray-900' 
        : 'hover:bg-gray-200 text-gray-600'
    }`;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
      {/* Search */}
      <div className="relative w-72">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <i className="fa-solid fa-magnifying-glass"></i>
        </span>
        <input 
          type="text" 
          placeholder="搜索文件名、标签..." 
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-all"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-4">
        
        {/* Batch Select Button */}
        <button 
          onClick={onToggleSelectionMode} 
          className={`text-sm border px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
            isSelectionMode 
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
              : 'text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200'
          }`}
        >
          <i className="fa-regular fa-square-check"></i>
          <span>批量管理</span>
        </button>

        <div className="h-6 w-px bg-gray-200 mx-2"></div>

        {/* Orientation Filter */}
        <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-1 border border-gray-200">
          <button onClick={() => onTopFilterChange('orientation', 'all')} className={getBtnClass(topFilter.orientation === 'all')}>全部</button>
          <button onClick={() => onTopFilterChange('orientation', 'portrait')} className={getBtnClass(topFilter.orientation === 'portrait')}>竖屏</button>
          <button onClick={() => onTopFilterChange('orientation', 'landscape')} className={getBtnClass(topFilter.orientation === 'landscape')}>横屏</button>
        </div>

        {/* Content Filter */}
        <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-1 border border-gray-200">
          <button onClick={() => onTopFilterChange('content', 'all')} className={getBtnClass(topFilter.content === 'all')}>全部</button>
          <button onClick={() => onTopFilterChange('content', 'human')} className={getBtnClass(topFilter.content === 'human')}>人像</button>
          <button onClick={() => onTopFilterChange('content', 'scenery')} className={getBtnClass(topFilter.content === 'scenery')}>空镜</button>
        </div>

        {/* View Toggle (Static) */}
        <div className="border-l border-gray-300 pl-4 flex gap-2 text-gray-400">
          <button className="text-indigo-600 hover:text-indigo-700"><i className="fa-solid fa-table-cells-large text-lg"></i></button>
          <button className="hover:text-gray-600"><i className="fa-solid fa-list text-lg"></i></button>
        </div>
      </div>
    </header>
  );
};