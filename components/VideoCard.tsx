import React, { useRef, useState } from 'react';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggleSelect: (id: number) => void;
  onClick: (video: Video) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, isSelected, isSelectionMode, onToggleSelect, onClick }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const borderClass = isSelected 
    ? 'ring-2 ring-indigo-600 ring-offset-2 shadow-md transform scale-[1.02]' 
    : 'border-gray-100 hover:shadow-lg';

  const checkboxDisplay = isSelectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';
  const checkboxChecked = isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300';
  const checkIcon = isSelected ? <i className="fa-solid fa-check text-white text-[10px]"></i> : null;

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      onToggleSelect(video.id);
    } else {
      onClick(video);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(video.id);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (video.url && videoRef.current) {
      videoRef.current.play().catch(() => {}); // Ignore play errors (e.g. if user didn't interact yet)
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (video.url && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`break-inside-avoid mb-6 relative group cursor-pointer rounded-xl overflow-hidden bg-white shadow-sm border transition-all duration-300 ${borderClass}`}
    >
      {/* Checkbox */}
      <div 
        className={`absolute top-2 left-2 z-20 ${checkboxDisplay} transition-opacity duration-200`} 
        onClick={handleCheckboxClick}
      >
        <div className={`w-5 h-5 rounded border ${checkboxChecked} flex items-center justify-center shadow-sm`}>
          {checkIcon}
        </div>
      </div>

      {/* Thumbnail / Video */}
      <div className={`w-full ${video.heightClass} ${video.color} flex items-center justify-center relative overflow-hidden bg-gray-100`}>
        
        {/* Render Real Video/Thumbnail or Fallback Icon */}
        {video.url ? (
          <>
            {/* Show thumbnail if not hovering or if video fails to load, but hide if video is playing */}
            {video.thumbnail && (
              <img 
                src={video.thumbnail} 
                alt={video.title} 
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`}
              />
            )}
            <video
              ref={videoRef}
              src={video.url}
              muted
              loop
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
            />
          </>
        ) : (
          <i className={`fa-solid ${video.hasHuman ? 'fa-user' : 'fa-image'} text-4xl text-gray-300 opacity-50`}></i>
        )}
        
        {/* Play Button Overlay (Only when NOT hovering and NOT in selection mode) */}
        {!isSelectionMode && !isHovering && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center z-10 pointer-events-none">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
              <i className="fa-solid fa-play text-indigo-600 pl-1"></i>
            </div>
          </div>
        )}
        
        <span className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded font-mono z-10">
          {video.duration}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-gray-800 truncate mb-2" title={video.title}>{video.title}</h4>
        <div className="flex flex-wrap gap-1">
          {video.orientation === 'portrait' 
            ? <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">#竖屏</span>
            : <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">#横屏</span>
          }
          {video.hasHuman 
            ? <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">#有人像</span>
            : <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full">#空镜</span>
          }
        </div>
      </div>
    </div>
  );
};