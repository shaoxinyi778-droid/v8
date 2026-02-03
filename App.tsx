import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { VideoCard } from './components/VideoCard';
import { BatchActionBar } from './components/BatchActionBar';
import { UploadModal } from './components/UploadModal';
import { DetailModal } from './components/DetailModal';
import { Toast, ToastState } from './components/Toast';
import { MOCK_VIDEOS } from './constants';
import { FilterFolder, TopFilterState, Video, Project } from './types';
import { getVideoFile, deleteVideoFile, getStorageUsage, exportDatabaseConfig, importDatabaseConfig } from './utils/db';

function App() {
  // Data State with Persistence
  const [videos, setVideos] = useState<Video[]>(() => {
    try {
      const saved = localStorage.getItem('smartclip_videos');
      return saved ? JSON.parse(saved) : MOCK_VIDEOS;
    } catch (e) {
      console.error("Failed to load videos from local storage", e);
      return MOCK_VIDEOS;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('smartclip_projects');
      return saved ? JSON.parse(saved) : [
        { id: 101, name: '2023春季营销', createdAt: '2023-01-01' }, // Default mock project
      ];
    } catch (e) {
      return [];
    }
  });

  const [storageUsage, setStorageUsage] = useState({ used: 0, quota: 0 });

  // Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedVideoDetail, setSelectedVideoDetail] = useState<Video | null>(null);

  // Update storage usage helper
  const updateStorageInfo = async () => {
    try {
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (e) {
      console.error("Failed to get storage usage", e);
    }
  };

  // Restore Video Blobs from IndexedDB on Mount & Handle Deep Linking
  useEffect(() => {
    const hydrateVideos = async () => {
      const hydrated = await Promise.all(videos.map(async (v) => {
        // If it's a mock video (small ID) or already has a valid remote URL (not blob), skip DB check
        // We assume IDs > 100000 are likely timestamp-based uploaded videos
        if (v.id < 1000000 && !v.url?.startsWith('blob:')) return v;

        // Try to get the blob from DB
        const blob = await getVideoFile(v.id);
        if (blob) {
          const newUrl = URL.createObjectURL(blob);
          // Only update if URL is different (avoid unnecessary updates if possible, though blob URLs change on refresh anyway)
          if (v.url !== newUrl) {
            return { ...v, url: newUrl };
          }
        }
        return v;
      }));
      
      const hasChanges = hydrated.some((v, i) => v.url !== videos[i].url);
      if (hasChanges) {
        setVideos(hydrated);
      }
      
      updateStorageInfo();

      // --- Deep Link Handling ---
      // Check if URL has ?v=ID
      const params = new URLSearchParams(window.location.search);
      const linkedVideoId = params.get('v');
      if (linkedVideoId) {
        const targetId = parseFloat(linkedVideoId);
        const targetVideo = hydrated.find(v => v.id === targetId);
        if (targetVideo) {
          setSelectedVideoDetail(targetVideo);
          // Clear URL so refreshing doesn't keep reopening it
          window.history.replaceState({}, document.title, window.location.pathname);
          showToast('已自动打开分享的视频', 'success');
        } else {
          showToast('无法找到分享的视频，可能是数据未同步', 'error');
        }
      }
    };
    
    hydrateVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('smartclip_videos', JSON.stringify(videos));
  }, [videos]);

  useEffect(() => {
    localStorage.setItem('smartclip_projects', JSON.stringify(projects));
  }, [projects]);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Filter State
  const [currentFolder, setCurrentFolder] = useState<FilterFolder>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [topFilter, setTopFilter] = useState<TopFilterState>({ orientation: 'all', content: 'all' });

  // Toast State
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false });

  // Helper: Show Toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // ---------------- Data Import/Export Logic ----------------
  const handleExportDB = () => {
    exportDatabaseConfig(videos, projects);
    showToast('数据库配置文件已导出', 'success');
  };

  const handleImportDB = async (file: File) => {
    try {
      const data = await importDatabaseConfig(file);
      if (data) {
        // --- Merge Logic: Additive (Preserve Local) ---
        let addedProjectsCount = 0;
        let addedVideosCount = 0;

        setProjects(prevProjects => {
          const existingIds = new Set(prevProjects.map(p => p.id));
          const newProjects = data.projects.filter(p => !existingIds.has(p.id));
          addedProjectsCount = newProjects.length;
          return [...prevProjects, ...newProjects];
        });

        setVideos(prevVideos => {
          const existingIds = new Set(prevVideos.map(v => v.id));
          const newVideos = data.videos.filter(v => !existingIds.has(v.id));
          addedVideosCount = newVideos.length;
          
          // Delayed toast to ensure state calculations are ready for display logic if needed
          // but we use local vars here which is fine.
          if (newVideos.length === 0 && data.videos.length > 0) {
             setTimeout(() => showToast('导入完成：所有视频已存在，未新增', 'success'), 100);
          } else {
             setTimeout(() => showToast(`合并成功：新增 ${newVideos.length} 个视频，${addedProjectsCount} 个项目`, 'success'), 100);
          }

          return [...prevVideos, ...newVideos];
        });
        
        updateStorageInfo();
      }
    } catch (e) {
      console.error(e);
      showToast('导入失败：文件格式错误', 'error');
    }
  };

  // ---------------- Project Logic ----------------
  const handleCreateProject = () => {
    const name = window.prompt("请输入新文件夹名称：");
    if (name && name.trim()) {
      const newProject: Project = {
        id: Date.now(),
        name: name.trim(),
        createdAt: new Date().toISOString()
      };
      setProjects(prev => [...prev, newProject]);
      showToast(`已创建文件夹 "${name}"`, 'success');
    }
  };

  const handleDeleteProject = (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("确定要删除此文件夹吗？文件夹内的视频将保留在“全部素材”中。")) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      // If currently viewing this project, switch back to all
      if (currentFolder === `project-${projectId}`) {
        setCurrentFolder('all');
      }
      // Remove project association from videos
      setVideos(prev => prev.map(v => v.projectId === projectId ? { ...v, projectId: undefined } : v));
      showToast('文件夹已删除', 'success');
    }
  };

  // ---------------- Filtering Logic ----------------
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      // 1. Sidebar Folder Filter
      const isDeleted = !!video.isDeleted;
      
      if (isDeleted && currentFolder !== 'trash') return false; // Hide deleted items unless in trash
      if (!isDeleted && currentFolder === 'trash') return false;

      // Handle Project Filtering (format: 'project-123')
      if (currentFolder.startsWith('project-')) {
        const projectId = parseInt(currentFolder.split('-')[1]);
        if (video.projectId !== projectId) return false;
      } else {
        switch (currentFolder) {
          case 'fav': if (!video.isFavorite) return false; break;
          case 'trash': if (!isDeleted) return false; break;
          case 'v-human': if (!(video.orientation === 'portrait' && video.hasHuman)) return false; break;
          case 'v-scenery': if (!(video.orientation === 'portrait' && !video.hasHuman)) return false; break;
          case 'h-human': if (!(video.orientation === 'landscape' && video.hasHuman)) return false; break;
          case 'h-scenery': if (!(video.orientation === 'landscape' && !video.hasHuman)) return false; break;
          case 'all': default: break;
        }
      }

      // 2. Search Filter
      if (searchTerm) {
        if (!video.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }

      // 3. Top Bar Filters
      if (topFilter.orientation !== 'all' && video.orientation !== topFilter.orientation) return false;
      if (topFilter.content !== 'all') {
        const isHuman = topFilter.content === 'human';
        if (video.hasHuman !== isHuman) return false;
      }

      return true;
    });
  }, [videos, currentFolder, searchTerm, topFilter]);

  // ---------------- Selection Logic ----------------
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      // Exiting mode
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setIsSelectionMode(true);
    }
  };

  const handleToggleSelect = (id: number) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = filteredVideos.map(v => v.id);
    setSelectedIds(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // ---------------- Batch Actions ----------------
  const handleBatchDownload = () => {
    if (selectedIds.size === 0) return showToast('请先选择视频', 'error');
    
    const selectedVideos = videos.filter(v => selectedIds.has(v.id));
    let realDownloadCount = 0;

    selectedVideos.forEach(video => {
      if (video.url && video.url.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = video.url;
        a.download = video.title;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        realDownloadCount++;
      }
    });

    if (realDownloadCount > 0) {
      showToast(`已触发 ${realDownloadCount} 个文件的下载任务`, 'success');
    } else {
      showToast(`模拟下载：${selectedIds.size} 个视频已加入下载队列`, 'success');
    }

    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return showToast('请先选择视频', 'error');

    // 1. Permanent Delete if in Trash
    if (currentFolder === 'trash') {
      if (!window.confirm(`确定要彻底删除选中的 ${selectedIds.size} 个视频吗？此操作无法撤销。`)) return;

      // Iterate and delete from DB
      const idsToDelete = Array.from(selectedIds) as number[];
      
      // We use Promise.all to process concurrent DB deletions (IndexedDB handles concurrency well)
      await Promise.all(idsToDelete.map(id => deleteVideoFile(id)));
      
      // Update State
      setVideos(prev => prev.filter(v => !selectedIds.has(v.id)));
      
      showToast(`已彻底删除 ${selectedIds.size} 个视频`, 'success');
      updateStorageInfo(); // Update quota usage

    } else {
      // 2. Soft Delete (Move to Trash)
      if (!window.confirm(`确定要将选中的 ${selectedIds.size} 个视频移至回收站吗？`)) return;

      setVideos(prev => prev.map(v => {
        if (selectedIds.has(v.id)) {
          return { ...v, isDeleted: true };
        }
        return v;
      }));
      
      showToast(`已将 ${selectedIds.size} 个视频移至回收站`, 'success');
    }

    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // ---------------- Single Video Actions ----------------
  const handleDownloadVideo = (video: Video) => {
    if (video.url && video.url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = video.url;
      a.download = video.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('开始下载...', 'success');
    } else {
      showToast(`模拟下载: ${video.title}`, 'success');
    }
  };

  const handleToggleFavorite = (id: number) => {
    setVideos(prev => prev.map(v => {
      if (v.id === id) {
        const newStatus = !v.isFavorite;
        // Update both the list and the currently selected detail view if needed
        if (selectedVideoDetail && selectedVideoDetail.id === id) {
          setSelectedVideoDetail(current => current ? ({ ...current, isFavorite: newStatus }) : null);
        }
        if (newStatus) {
            showToast('已添加到收藏夹', 'success');
        } else {
            showToast('已取消收藏', 'success');
        }
        return { ...v, isFavorite: newStatus };
      }
      return v;
    }));
  };

  const handleDeleteVideo = (id: number) => {
    const targetVideo = videos.find(v => v.id === id);
    if (!targetVideo) return;

    if (targetVideo.isDeleted) {
      // Permanent Delete
      if (!window.confirm("确定要彻底删除此视频吗？此操作无法撤销。")) return;
      
      // Clean up from IndexedDB
      deleteVideoFile(id)
        .then(() => updateStorageInfo()) // Update storage
        .catch(err => console.error("DB Cleanup failed", err));

      setVideos(prev => prev.filter(v => v.id !== id));
      setSelectedVideoDetail(null);
      showToast('视频已彻底删除', 'success');
    } else {
      // Move to Trash
      if (!window.confirm("确定要删除此视频吗？它将被移至回收站。")) return;
      setVideos(prev => prev.map(v => {
        if (v.id === id) return { ...v, isDeleted: true };
        return v;
      }));
      setSelectedVideoDetail(null);
      showToast('视频已移至回收站', 'success');
    }
  };

  const handleRestoreVideo = (id: number) => {
    setVideos(prev => prev.map(v => {
      if (v.id === id) return { ...v, isDeleted: false };
      return v;
    }));
    
    if (selectedVideoDetail && selectedVideoDetail.id === id) {
      setSelectedVideoDetail(prev => prev ? ({ ...prev, isDeleted: false }) : null);
    }
    showToast('视频已恢复', 'success');
  };

  const handleShareVideo = (video: Video) => {
     // This action is now handled in DetailModal with the link generation
     showToast('分享链接已复制，可发给已同步数据的同事', 'success');
  };

  const handleUploadComplete = (newVideos: Video[]) => {
    setVideos(prev => [...newVideos, ...prev]);
    showToast(`成功上传并归类 ${newVideos.length} 个视频`, 'success');
    updateStorageInfo(); // Update storage
  };

  // ---------------- Helper for Title ----------------
  const getFolderTitle = () => {
    if (currentFolder.startsWith('project-')) {
      const pid = parseInt(currentFolder.split('-')[1]);
      const project = projects.find(p => p.id === pid);
      return project ? `项目：${project.name}` : '未知项目';
    }

    switch (currentFolder) {
      case 'all': return '全部素材';
      case 'fav': return '收藏夹';
      case 'trash': return '回收站';
      case 'v-human': return '智能筛选：竖屏 & 有人像';
      case 'v-scenery': return '智能筛选：竖屏 & 空镜';
      case 'h-human': return '智能筛选：横屏 & 有人像';
      case 'h-scenery': return '智能筛选：横屏 & 空镜';
      default: return '未知文件夹';
    }
  };

  return (
    <div className="flex h-full">
      <Sidebar 
        currentFolder={currentFolder} 
        onFilterChange={setCurrentFolder} 
        onUploadClick={() => setIsUploadModalOpen(true)}
        projects={projects}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        storageUsage={storageUsage}
        onExportDB={handleExportDB}
        onImportDB={handleImportDB}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
        <TopBar 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          topFilter={topFilter}
          onTopFilterChange={(k, v) => setTopFilter(prev => ({ ...prev, [k]: v }))}
        />

        <div className="flex-1 overflow-y-auto p-6 pb-24">
          {/* Header */}
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{getFolderTitle()}</h1>
              <p className="text-sm text-gray-500 mt-1">共 {filteredVideos.length} 个项目</p>
            </div>
            <div className="text-sm text-gray-500">
              按 <span className="font-medium text-gray-700 cursor-pointer">上传时间 <i className="fa-solid fa-chevron-down text-xs"></i></span> 排序
            </div>
          </div>

          {/* Grid */}
          {filteredVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <i className="fa-regular fa-folder-open text-5xl mb-4"></i>
              <p>该文件夹下暂无内容</p>
              {currentFolder.startsWith('project-') && (
                <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                    去上传视频到此项目
                </button>
              )}
            </div>
          ) : (
            <div className="columns-2 lg:columns-3 xl:columns-4 gap-6 pb-10">
              {filteredVideos.map(video => (
                <VideoCard 
                  key={video.id} 
                  video={video}
                  isSelected={selectedIds.has(video.id)}
                  isSelectionMode={isSelectionMode}
                  onToggleSelect={handleToggleSelect}
                  onClick={setSelectedVideoDetail}
                />
              ))}
            </div>
          )}
        </div>

        <BatchActionBar 
          isVisible={isSelectionMode}
          selectedCount={selectedIds.size}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onDownload={handleBatchDownload}
          onDelete={handleBatchDelete}
          onClose={toggleSelectionMode}
        />
      </main>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onComplete={handleUploadComplete}
        projects={projects}
        initialProjectId={currentFolder.startsWith('project-') ? parseInt(currentFolder.split('-')[1]) : undefined}
        existingVideos={videos}
      />

      <DetailModal 
        video={selectedVideoDetail} 
        onClose={() => setSelectedVideoDetail(null)}
        onDownload={handleDownloadVideo}
        onFavorite={handleToggleFavorite}
        onDelete={handleDeleteVideo}
        onRestore={handleRestoreVideo}
        onShare={handleShareVideo}
      />

      <Toast toast={toast} />
    </div>
  );
}

export default App;