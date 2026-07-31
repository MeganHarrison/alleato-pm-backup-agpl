'use client';
/* eslint-disable design-system/no-raw-heading */

import React, { useState } from 'react';
import { Search, Menu, Bell, Globe, FileText, Users, Settings, CheckCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  tag: string;
  name: string;
  role: string;
  lastModified: string;
  lastEntry: string;
  myTasks: number;
  stats: {
    icon1: number;
    icon2: number;
    icon3: number;
    icon4: number;
  };
  details?: {
    status: string;
    assignees: Array<{ name: string; time: string; task?: string }>;
  };
}

const PROJECTS: Project[] = Array(15).fill(null).map((_, i) => ({
  id: `${i + 1}`,
  tag: 'DEMO',
  name: 'BSD at Alleato',
  role: 'Administrators',
  lastModified: '22.04.2021',
  lastEntry: '22.04.2021',
  myTasks: 193,
  stats: {
    icon1: 21,
    icon2: 41,
    icon3: 793,
    icon4: 793
  },
  details: {
    status: 'Design',
    assignees: [
      { name: 'Ted Mosby', time: '14.04.14 10:37' },
      { name: 'Erik Clarkson', time: '14.04.14 10:37' },
      { name: 'Gilbert Savage', time: '14.04.14 10:37' },
      { name: 'Courtney Henry', time: '14.04.14 10:37' },
      { name: 'Jenny Wilson', time: '14.04.14 10:37' },
      { name: 'Guy Hawkins', time: '14.04.14 10:37' },
      { name: 'Robert Fox', time: '12.04.12 04:55', task: 'Nesingne nendienium' },
      { name: 'Jacob Jones', time: '12.04.12 04:55', task: 'Nesingne nendienium' },
      { name: 'Cody Fisher', time: '12.04.12 04:55' },
      { name: 'Ralph Edwards', time: '12.04.12 04:55', task: 'Nesingne nendienium' },
    ]
  }
}));

export default function ProjectsTableDemo() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(2);

  const selectedProjectData = PROJECTS.find(p => p.id === selectedProject);

  return (
    <div className="projects-layout">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --color-bg-primary: #2D3139;
          --color-bg-secondary: #353B45;
          --color-bg-tertiary: #404856;
          --color-nav: #3A4556;
          --color-accent-orange: #FF6B35;
          --color-accent-yellow: #FFB84D;
          --color-accent-blue: #5B9DD9;
          --color-text-primary: #FFFFFF;
          --color-text-secondary: #B8BEC8;
          --color-text-muted: #7B818A;
          --color-border: #4B5563;
          --color-row-hover: rgba(255, 107, 53, 0.06);
          --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        body {
          font-family: var(--font-sans);
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .projects-layout {
          display: flex;
          height: 100vh;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          position: relative;
        }

        /* Grain overlay */
        .projects-layout::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 100;
        }

        /* Left Sidebar */
        .left-sidebar {
          width: 60px;
          background: var(--color-nav);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem 0;
          gap: 1.5rem;
          border-right: 1px solid var(--color-border);
          z-index: 10;
        }

        .logo {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--color-accent-orange), var(--color-accent-yellow));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.125rem;
          color: white;
          margin-bottom: 1rem;
        }

        .nav-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-icon:hover {
          background: rgba(255, 107, 53, 0.1);
          color: var(--color-accent-orange);
        }

        .nav-icon.active {
          background: var(--color-accent-orange);
          color: white;
        }

        /* Main Content */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Top Bar */
        .top-bar {
          height: 60px;
          background: var(--color-nav);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          border-bottom: 1px solid var(--color-border);
        }

        .page-title-bar {
          font-size: 1.125rem;
          font-weight: 600;
          letter-spacing: -0.015em;
        }

        .top-bar-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          position: relative;
        }

        .search-dropdown-wrapper {
          position: relative;
        }

        .search-trigger {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          border: none;
        }

        .search-trigger:hover {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .search-trigger.active {
          background: var(--color-bg-secondary);
          color: var(--color-accent-orange);
        }

        .search-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 320px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          padding: 0.75rem;
          animation: slideDown 0.2s ease;
          z-index: 1000;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .search-input-dropdown {
          width: 100%;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          font-family: var(--font-sans);
          color: var(--color-text-primary);
          transition: all 0.2s;
        }

        .search-input-dropdown:focus {
          outline: none;
          border-color: var(--color-accent-orange);
          box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
        }

        .search-input-dropdown::placeholder {
          color: var(--color-text-muted);
        }

        .top-bar-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .top-bar-icon:hover {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .notification-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 8px;
          height: 8px;
          background: var(--color-accent-orange);
          border-radius: 50%;
          border: 2px solid var(--color-nav);
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-accent-orange), var(--color-accent-yellow));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
        }

        /* Table Container */
        .table-container {
          flex: 1;
          overflow: auto;
          display: flex;
        }

        .table-wrapper {
          flex: 1;
          padding: 0;
        }

        .projects-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .projects-table thead {
          position: sticky;
          top: 0;
          z-index: 5;
          background: var(--color-bg-secondary);
        }

        .projects-table th {
          padding: 0.875rem 1rem;
          text-align: left;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
        }

        .projects-table tbody tr {
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid rgba(75, 85, 99, 0.2);
        }

        .projects-table tbody tr:hover {
          background: var(--color-row-hover);
        }

        .projects-table tbody tr.selected {
          background: rgba(255, 107, 53, 0.1);
          border-left: 3px solid var(--color-accent-orange);
        }

        .projects-table td {
          padding: 0.75rem 1rem;
          color: var(--color-text-primary);
          white-space: nowrap;
          font-size: 0.875rem;
        }

        .project-tag-cell {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--color-text-muted);
          letter-spacing: 0.02em;
        }

        .project-name-cell {
          font-weight: 500;
        }

        .stats-icons {
          display: flex;
          gap: 0.875rem;
          align-items: center;
        }

        .stat-item-icon {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .stat-item-icon svg {
          width: 13px;
          height: 13px;
          opacity: 0.5;
        }

        /* Right Sidebar Panel */
        .right-panel {
          width: 360px;
          background: var(--color-bg-secondary);
          border-left: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .panel-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .panel-title {
          font-size: 0.9375rem;
          font-weight: 600;
        }

        .panel-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          border: none;
        }

        .panel-close:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .panel-section {
          margin-bottom: 2rem;
        }

        .panel-section-title {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          margin-bottom: 1rem;
        }

        .status-badge {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: rgba(255, 107, 53, 0.15);
          color: var(--color-accent-orange);
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.8125rem;
        }

        .assignee-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .assignee-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0.875rem;
          background: var(--color-bg-primary);
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .assignee-name {
          font-weight: 500;
          color: var(--color-text-primary);
          font-size: 0.875rem;
        }

        .assignee-time {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-top: 0.25rem;
          font-variant-numeric: tabular-nums;
        }

        .assignee-task {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-top: 0.25rem;
        }

        .assignee-info {
          flex: 1;
        }

        .status-indicator {
          width: 3px;
          height: 100%;
          background: linear-gradient(180deg, var(--color-accent-orange), var(--color-accent-yellow));
          border-radius: 2px;
          margin-right: 0.875rem;
        }

        /* Pagination */
        .pagination-bar {
          height: 60px;
          background: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .page-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .page-btn:hover:not(:disabled) {
          background: var(--color-bg-tertiary);
          border-color: var(--color-accent-yellow);
          color: var(--color-text-primary);
        }

        .page-btn.active {
          background: linear-gradient(135deg, var(--color-accent-orange), var(--color-accent-yellow));
          border-color: transparent;
          color: white;
        }

        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .page-dots {
          color: var(--color-text-muted);
          padding: 0 0.25rem;
        }

        /* Scrollbar */
        .table-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .table-container::-webkit-scrollbar-track {
          background: var(--color-bg-primary);
        }

        .table-container::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 4px;
        }

        .table-container::-webkit-scrollbar-thumb:hover {
          background: var(--color-accent-orange);
        }
      `}</style>

      {/* Left Sidebar */}
      <aside className="left-sidebar">
        <div className="logo">A</div>
        <div className="nav-icon active">
          <Menu size={20} />
        </div>
        <div className="nav-icon">
          <FileText size={20} />
        </div>
        <div className="nav-icon">
          <Users size={20} />
        </div>
        <div className="nav-icon">
          <CheckCircle size={20} />
        </div>
        <div className="nav-icon">
          <Settings size={20} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <h1 className="page-title-bar">Projects | BSD at Alleato</h1>
          <div className="top-bar-actions">
            {/* Search Dropdown */}
            <div className="search-dropdown-wrapper">
              <Button
                type="button"
                className={`search-trigger ${searchOpen ? 'active' : ''}`}
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search size={20} />
              </Button>
              {searchOpen && (
                <div className="search-dropdown">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    className="search-input-dropdown"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="top-bar-icon">
              <Bell size={20} />
              <span className="notification-badge"></span>
            </div>
            <div className="user-avatar">M</div>
            <div className="top-bar-icon">
              <Globe size={20} />
            </div>
          </div>
        </header>

        {/* Table */}
        <div className="table-container">
          <div className="table-wrapper">
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Project Tag</th>
                  <th>Project Name</th>
                  <th>Role</th>
                  <th>Last Modified</th>
                  <th>Last Entry</th>
                  <th>My Tasks</th>
                  <th>Project Stats</th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((project) => (
                  <tr
                    key={project.id}
                    className={selectedProject === project.id ? 'selected' : ''}
                    onClick={() => setSelectedProject(project.id)}
                  >
                    <td className="project-tag-cell">{project.tag}</td>
                    <td className="project-name-cell">{project.name}</td>
                    <td>{project.role}</td>
                    <td>{project.lastModified}</td>
                    <td>{project.lastEntry}</td>
                    <td>{project.myTasks}</td>
                    <td>
                      <div className="stats-icons">
                        <span className="stat-item-icon">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                            <circle cx="7" cy="7" r="6" opacity="0.6"/>
                          </svg>
                          {project.stats.icon1}
                        </span>
                        <span className="stat-item-icon">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                            <rect x="2" y="2" width="10" height="10" opacity="0.6"/>
                          </svg>
                          {project.stats.icon2}
                        </span>
                        <span className="stat-item-icon">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                            <path d="M2 2 L12 2 L7 12 Z" opacity="0.6"/>
                          </svg>
                          {project.stats.icon3}
                        </span>
                        <span className="stat-item-icon">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                            <circle cx="7" cy="7" r="5" opacity="0.6"/>
                          </svg>
                          {project.stats.icon4}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right Panel */}
          {selectedProject && selectedProjectData && (
            <aside className="right-panel">
              <div className="panel-header">
                <h3 className="panel-title">Project Details</h3>
                <Button type="button" className="panel-close" variant="ghost" size="icon" onClick={() => setSelectedProject(null)}>
                  <X size={20} />
                </Button>
              </div>
              <div className="panel-content">
                <div className="panel-section">
                  <div className="panel-section-title">Projekto statusas</div>
                  <div className="status-badge">{selectedProjectData.details?.status}</div>
                </div>

                <div className="panel-section">
                  <div className="panel-section-title">Projekto aprašas</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    Koordinuotojai sistemos
                  </p>
                </div>

                <div className="panel-section">
                  <div className="panel-section-title">Projekto darbetos</div>
                  <div className="assignee-list">
                    {selectedProjectData.details?.assignees.map((assignee, idx) => (
                      <div key={idx} className="assignee-item">
                        <div className="status-indicator"></div>
                        <div className="assignee-info">
                          <div className="assignee-name">{assignee.name}</div>
                          <div className="assignee-time">{assignee.time}</div>
                          {assignee.task && <div className="assignee-task">{assignee.task}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Pagination */}
        <div className="pagination-bar">
          <Button type="button" className="page-btn" variant="ghost" size="icon">
            <ChevronLeft size={16} />
          </Button>
          <Button type="button" className="page-btn" variant="ghost" size="icon">1</Button>
          <Button type="button" className="page-btn active" variant="ghost" size="icon">2</Button>
          <Button type="button" className="page-btn" variant="ghost" size="icon">3</Button>
          <span className="page-dots">•••</span>
          <Button type="button" className="page-btn" variant="ghost" size="icon">10</Button>
          <Button type="button" className="page-btn" variant="ghost" size="icon">
            <ChevronRight size={16} />
          </Button>
        </div>
      </main>
    </div>
  );
}
