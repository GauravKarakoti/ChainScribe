import React, { useState, useMemo } from 'react';
import {
    History, Clock, User, FileText, CheckCircle, AlertCircle,
    Filter, Search, ChevronDown, ChevronUp
} from 'lucide-react';

// --- Helper Functions (moved outside) ---

const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
};

const getChangeTypeIcon = (changeType) => {
    switch (changeType) {
      case 'major':
        return <FileText size={14} className="text-blue-400" />;
      case 'minor':
        return <AlertCircle size={14} className="text-gray-400" />;
      default:
        return <History size={14} className="text-gray-400" />;
    }
};

const getChangeTypeColor = (changeType) => {
    switch (changeType) {
      case 'major':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'minor':
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
};

// --- Sub-components ---

const ChangeHistoryHeader = ({ changesCount, searchTerm, onSearchChange, filter, onFilterChange }) => (
    <div className="change-history-header">
        <div className="flex items-center gap-2 mb-4">
            <History size={18} className="text-primary" />
            <h3 className="text-lg font-semibold text-primary">Change History</h3>
            {changesCount > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
                    {changesCount}
                </span>
            )}
        </div>
        <div className="space-y-3 mb-4">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search changes..."
                    value={searchTerm}
                    onChange={onSearchChange}
                    className="w-full pl-10 pr-4 py-2 bg-dark-light border border-border rounded-lg text-sm text-text placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
            </div>
            <div className="flex gap-2">
                {['all', 'major', 'minor'].map(filterType => (
                    <button
                        key={filterType}
                        onClick={() => onFilterChange(filterType)}
                        className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                             filter === filterType
                                ? (filterType === 'major' ? 'bg-blue-400/20 text-blue-400 border-blue-400/30' :
                                   filterType === 'minor' ? 'bg-gray-400/20 text-gray-400 border-gray-400/30' :
                                   'bg-primary/20 text-primary border-primary/30')
                                : `bg-dark-light text-text-muted border-border hover:border-${filterType === 'major' ? 'blue-400/50' : filterType === 'minor' ? 'gray-400/50' : 'primary/50'}`
                        }`}
                    >
                        {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    </div>
);

const ChangeDetails = ({ change }) => (
    // Added padding and spacing
    <div className="change-details mt-3 pt-3 border-t border-border/50 space-y-3 bg-dark-light p-3 rounded-b-lg">
        {/* Author moved here */}
        {change.author && (
            <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted flex items-center gap-1"><User size={12} /> Author:</span>
                <span className="text-text font-mono">{change.author}</span>
            </div>
        )}
        {/* Change Type Badge moved here */}
        <div className="flex items-center justify-between text-xs">
             <span className="text-text-muted">Change Type:</span>
             <span className={`change-type px-2 py-1 rounded-full text-xs font-medium border ${getChangeTypeColor(change.changeType)}`}>
                 {change.changeType || 'unknown'}
             </span>
        </div>

        {/* --- AI/Verification Info --- */}
        {change.proof && (
            <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="verification-badge flex items-center gap-2 text-xs text-green-400 font-medium">
                    <CheckCircle size={14} />
                    <span>Verified with 0G Compute</span>
                </div>
                 {change.modelId && (
                    <div className="model-info flex items-center justify-between text-xs">
                        <span className="text-text-muted">AI Model:</span>
                        <span className="text-text font-mono">{change.modelId}</span>
                    </div>
                )}
                 {change.proof && (
                    <div className="proof-info">
                         <div className="flex items-center justify-between text-xs mb-1">
                             <span className="text-text-muted">Compute Proof:</span>
                         </div>
                         {/* Consider adding a copy button or tooltip for full proof */}
                         <code className="block p-2 bg-dark-lighter border border-border/50 rounded text-xs text-text-muted font-mono break-all max-h-[60px] overflow-y-auto">
                             {change.proof.substring(0, 30)}...{change.proof.substring(change.proof.length - 10)}
                         </code>
                     </div>
                )}
                 {change.requiresAI !== undefined && (
                    <div className="flex items-center gap-1 text-xs">
                        <span className="text-text-muted">AI Analysis:</span>
                        <span className={change.requiresAI ? 'text-green-400' : 'text-text-muted'}>
                            {change.requiresAI ? 'Yes' : 'No'}
                        </span>
                    </div>
                )}
            </div>
        )}

        {/* --- Document Info --- */}
         <div className="space-y-2 pt-2 border-t border-border/30">
            {change.documentId && (
                 <div className="document-info flex items-center justify-between text-xs">
                    <span className="text-text-muted">Document:</span>
                    <span className="text-text font-mono truncate ml-2 max-w-[150px]">{change.documentId}</span>
                </div>
            )}
            {change.contentHash && (
                 <div>
                     <span className="text-text-muted text-xs">Content Hash:</span>
                     <code className="block mt-1 p-1 bg-dark-lighter rounded text-xs text-text-muted font-mono truncate">
                         {change.contentHash}
                     </code>
                 </div>
            )}
         </div>

        {/* Full Summary (if long) */}
        {change.summary && change.summary.length > 50 && ( // Show if summary was truncated
            <div className="full-summary mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-text leading-relaxed">{change.summary}</p>
            </div>
        )}
    </div>
);


const ChangeItem = ({ change, index, selectedVersion, expanded, onClick, onToggleExpand }) => (
    // Added more padding (p-3) and a slight hover effect
     <div
        className={`change-item-container bg-dark rounded-lg border border-border/50 transition-shadow hover:shadow-md ${selectedVersion === index ? 'ring-2 ring-primary/50' : ''}`}
    >
        <div
            className={`change-item-header p-3 cursor-pointer flex items-start justify-between gap-2 ${expanded ? 'rounded-t-lg' : 'rounded-lg'}`}
            onClick={onClick}
        >
            {/* Icon and Summary/Time */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {getChangeTypeIcon(change.changeType)}
                <div className="flex-1 min-w-0">
                     {/* Increased font size slightly and removed truncate here */}
                    <p className="change-summary text-[0.9rem] font-medium text-text mb-1 line-clamp-2">{change.summary}</p>
                    <div className="change-meta flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                            <Clock size={12} /> {formatTimestamp(change.timestamp)}
                        </span>
                        {/* Author moved to details */}
                    </div>
                </div>
            </div>
            {/* Expand Button */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                className="p-1 mt-1 hover:bg-dark-lighter rounded transition-colors flex-shrink-0"
            >
                {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
             </button>
        </div>
        {/* Render details below the header */}
        {expanded && <ChangeDetails change={change} />}
     </div>
);

const ChangeStatistics = ({ changes }) => {
     const majorCount = changes.filter(c => c.changeType === 'major').length;
     const minorCount = changes.filter(c => c.changeType === 'minor').length;

     return (
        <div className="change-statistics mt-4 pt-4 border-t border-border">
             <div className="grid grid-cols-3 gap-4 text-xs">
                 <div className="text-center">
                     <div className="text-text font-semibold">{changes.length}</div>
                     <div className="text-text-muted">Total</div>
                 </div>
                 <div className="text-center">
                     <div className="text-blue-400 font-semibold">{majorCount}</div>
                     <div className="text-text-muted">Major</div>
                 </div>
                 <div className="text-center">
                     <div className="text-gray-400 font-semibold">{minorCount}</div>
                     <div className="text-text-muted">Minor</div>
                 </div>
             </div>
         </div>
     );
};

// --- Main Component ---

export const ChangeHistory = ({ changes = [], onVersionSelect, selectedVersion }) => {
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedVersion, setExpandedVersion] = useState(null);

    const filteredChanges = useMemo(() => {
        return changes.filter(change => {
            const matchesFilter = filter === 'all' || change.changeType === filter;
            const matchesSearch =
                change.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                change.documentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                change.author?.toLowerCase().includes(searchTerm.toLowerCase()) || // Added author search
                change.modelId?.toLowerCase().includes(searchTerm.toLowerCase()); // Added modelId search
            return matchesFilter && matchesSearch;
        });
    }, [changes, filter, searchTerm]);

    const toggleVersionExpansion = (versionIndex) => {
        setExpandedVersion(expandedVersion === versionIndex ? null : versionIndex);
    };

    const handleVersionClick = (change, index) => {
        if (onVersionSelect) {
            onVersionSelect(change, index);
        }
        // Keep expansion separate from selection if desired, or toggle here
         toggleVersionExpansion(index);
    };

    return (
        <div className="change-history">
            <ChangeHistoryHeader
                changesCount={changes.length}
                searchTerm={searchTerm}
                onSearchChange={(e) => setSearchTerm(e.target.value)}
                filter={filter}
                onFilterChange={setFilter}
            />

            <div className="change-list space-y-3">
                {filteredChanges.length === 0 ? (
                    <div className="text-center py-8">
                        <History size={48} className="mx-auto text-gray-600 mb-3" />
                        <p className="text-text-muted text-sm">
                            {changes.length === 0 ? 'No changes recorded yet' : 'No changes match your search'}
                        </p>
                        <p className="text-text-muted text-xs mt-1">
                            {changes.length === 0 ? 'Document changes will appear here' : 'Try adjusting your search or filter'}
                        </p>
                    </div>
                ) : (
                    filteredChanges.map((change, index) => (
                        <ChangeItem
                            key={index}
                            change={change}
                            index={index}
                            selectedVersion={selectedVersion}
                            expanded={expandedVersion === index}
                            onClick={() => handleVersionClick(change, index)}
                            onToggleExpand={() => toggleVersionExpansion(index)}
                        />
                    ))
                )}
            </div>

            {changes.length > 0 && <ChangeStatistics changes={changes} />}
        </div>
    );
};

export default ChangeHistory;