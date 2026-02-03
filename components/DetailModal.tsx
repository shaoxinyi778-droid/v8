import React, { useRef, useState, useEffect } from 'react';
import { Video } from '../types';

interface DetailModalProps {
  video: Video | null;
  onClose: () => void;
  onDownload: (video: Video) => void;
  onFavorite: (id: number) => void;
  onShare: (video: Video) => void;
  onDelete: (id: number) => void;  // Moves to trash or permanently deletes
  onRestore: (id: number) => void; // Restores from trash
}

export const DetailModal: React.FC<DetailModalProps> = ({ 
  video, 
  onClose, 
  onDownload, 
  onFavorite, 
  onShare, 
  onDelete,
  onRestore
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Reset state when video changes
    setIsPlaying(false);
  }, [video]);

  // Keyboard shortcut support
  useEffect(() => {
    if (!video) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Support Delete or Backspace key to delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onDelete(video.id);
      }
      // Support Escape to close
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [video, onDelete, onClose]);

  if (!video) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const isTrashMode = !!video.isDeleted;

  // Generate shareable link
  const handleCopyLink = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('v', video.id.toString());
      navigator.clipboard.writeText(url.toString()).then(() => {
          onShare(video); // Trigger toast in parent
      });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Left Player Area */}
        <div className="flex-1 bg-black flex items-center justify-center relative group" onClick={togglePlay}>
          {video.url ? (
            <video 
              ref={videoRef}
              src={video.url} 
              className="w-full h-full object-contain"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <>
              {/* Fallback for mock data without URL */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <i className="fa-solid fa-play text-6xl text-white opacity-50 group-hover:opacity-100 cursor-pointer transition-opacity drop-shadow-lg"></i>
              </div>
              <div className={`w-full h-full ${video.color} opacity-80 flex items-center justify-center`}>
                 <i className={`fa-solid ${video.hasHuman ? 'fa-user' : 'fa-image'} text-9xl text-white opacity-20`}></i>
              </div>
            </>
          )}
        </div>
        
        {/* Right Info Area */}
        <div className="w-96 bg-white flex flex-col border-l border-gray-200">
          <div className="p-6 border-b border-gray-100 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight mb-2 pr-2">{video.title}</h2>
              <div className="flex items-center gap-2">
                 <p className="text-sm text-gray-500">上传于 {video.uploadDate}</p>
                 {isTrashMode && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-medium">回收站</span>}
              </div>
            </div>
            {/* Quick Favorite Icon in Header (Only show if not in trash) */}
            {!isTrashMode && (
              <button 
                onClick={() => onFavorite(video.id)}
                className={`text-xl transition-colors ${video.isFavorite ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                title={video.isFavorite ? "取消收藏" : "加入收藏"}
              >
                <i className={`fa-${video.isFavorite ? 'solid' : 'regular'} fa-heart`}></i>
              </button>
            )}
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* AI Tags */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">AI 智能标签</h3>
              <div className="flex flex-wrap gap-2">
                {video.orientation === 'portrait' 
                   ? <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-xs font-medium"># 竖屏模式</span>
                   : <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-medium"># 横屏模式</span>
                }
                {video.hasHuman 
                   ? <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded text-xs font-medium"># 包含人物</span>
                   : <span className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-medium"># 自然空镜</span>
                }
              </div>
              <button className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                <i className="fa-solid fa-plus"></i> 添加人工标签
              </button>
            </div>

            {/* Params */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">文件信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">分辨率</span>
                  <span className="text-gray-800 font-mono">{video.orientation === 'portrait' ? '1080x1920' : '1920x1080'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">时长</span>
                  <span className="text-gray-800 font-mono">{video.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">格式</span>
                  <span className="text-gray-800 font-mono">MP4 (H.264)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
            {!isTrashMode ? (
              // --- Normal View Actions ---
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => onDownload(video)}
                  className="col-span-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <i className="fa-solid fa-download"></i> 下载
                </button>
                
                <button 
                  onClick={() => onFavorite(video.id)}
                  className={`col-span-1 border py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-center justify-center gap-1 ${
                    video.isFavorite 
                      ? 'bg-red-50 border-red-200 text-red-500' 
                      : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <i className={`fa-${video.isFavorite ? 'solid' : 'regular'} fa-heart`}></i> 收藏
                </button>

                <button 
                  onClick={handleCopyLink}
                  className="col-span-1 border border-gray-200 hover:bg-gray-50 text-gray-600 py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <i className="fa-solid fa-link"></i> 分享
                </button>

                <button 
                  onClick={() => onDelete(video.id)}
                  className="col-span-1 border border-red-100 text-red-500 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <i className="fa-regular fa-trash-can"></i> 删除
                </button>
              </div>
            ) : (
              // --- Trash View Actions ---
              <div className="flex gap-3">
                <button 
                  onClick={() => onRestore(video.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <i className="fa-solid fa-rotate-left"></i> 恢复视频
                </button>
                <button 
                  onClick={() => onDelete(video.id)} // Will trigger permanent delete
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <i className="fa-solid fa-trash"></i> 彻底删除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};