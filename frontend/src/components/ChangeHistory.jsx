import React, { useState, useMemo } from 'react';
import { 
  History, 
  Clock, 
  User, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Filter,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const ChangeHistory = ({ changes = [], onVersionSelect, selectedVersion }) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedVersion, setExpandedVersion] = useState(null);

  // Filter and search changes
  const filteredChanges = useMemo(() => {
    return changes.filter(change => {
      const matchesFilter = filter === 'all' || change.changeType === filter;
      const matchesSearch = change.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           change.documentId?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [changes, filter, searchTerm]);

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

  const toggleVersionExpansion = (versionIndex) => {
    setExpandedVersion(expandedVersion === versionIndex ? null : versionIndex);
  };

  const handleVersionClick = (change, index) => {
    if (onVersionSelect) {
      onVersionSelect(change, index);
    }
    toggleVersionExpansion(index);
  };

  return (
    <div className="change-history">
      <div className="change-history-header">
        <div className="flex items-center gap-2 mb-4">
          <History size={18} className="text-primary" />
          <h3 className="text-lg font-semibold text-primary">Change History</h3>
          {changes.length > 0 && (
            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
              {changes.length}
            </span>
          )}
        </div>

        {/* Search and Filter Controls */}
        <div className="space-y-3 mb-4">
          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search changes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-light border border-border rounded-lg text-sm text-text placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                filter === 'all'
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'bg-dark-light text-text-muted border-border hover:border-primary/50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('major')}
              className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                filter === 'major'
                  ? 'bg-blue-400/20 text-blue-400 border-blue-400/30'
                  : 'bg-dark-light text-text-muted border-border hover:border-blue-400/50'
              }`}
            >
              Major
            </button>
            <button
              onClick={() => setFilter('minor')}
              className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                filter === 'minor'
                  ? 'bg-gray-400/20 text-gray-400 border-gray-400/30'
                  : 'bg-dark-light text-text-muted border-border hover:border-gray-400/50'
              }`}
            >
              Minor
            </button>
          </div>
        </div>
      </div>

      {/* Changes List */}
      <div className="change-list space-y-3">
        {filteredChanges.length === 0 ? (
          <div className="text-center py-8">
            <History size={48} className="mx-auto text-gray-600 mb-3" />
            <p className="text-text-muted text-sm">
              {changes.length === 0 ? 'No changes recorded yet' : 'No changes match your search'}
            </p>
            <p className="text-text-muted text-xs mt-1">
              {changes.length === 0 
                ? 'Document changes will appear here' 
                : 'Try adjusting your search or filter'
              }
            </p>
          </div>
        ) : (
          filteredChanges.map((change, index) => (
            <div
              key={index}
              className={`change-item cursor-pointer transition-all duration-200 ${
                selectedVersion === index ? 'ring-2 ring-primary/50' : ''
              }`}
              onClick={() => handleVersionClick(change, index)}
            >
              {/* Change Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getChangeTypeIcon(change.changeType)}
                  <div className="flex-1 min-w-0">
                    <p className="change-summary text-sm font-medium text-text truncate">
                      {change.summary}
                    </p>
                    <div className="change-meta flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Clock size={12} />
                        {formatTimestamp(change.timestamp)}
                      </span>
                      {change.author && (
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <User size={12} />
                          {change.author}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Change Type Badge */}
                  <span className={`change-type px-2 py-1 rounded-full text-xs font-medium border ${getChangeTypeColor(change.changeType)}`}>
                    {change.changeType || 'unknown'}
                  </span>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVersionExpansion(index);
                    }}
                    className="p-1 hover:bg-dark-lighter rounded transition-colors"
                  >
                    {expandedVersion === index ? (
                      <ChevronUp size={16} className="text-text-muted" />
                    ) : (
                      <ChevronDown size={16} className="text-text-muted" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedVersion === index && (
                <div className="change-details mt-3 pt-3 border-t border-border space-y-2">
                  {/* AI Verification Badge */}
                  {change.proof && (
                    <div className="verification-badge flex items-center gap-2 p-2 bg-green-400/10 border border-green-400/20 rounded-lg">
                      <CheckCircle size={14} className="text-green-400" />
                      <span className="text-xs text-green-400 font-medium">
                        Verified with 0G Compute
                      </span>
                    </div>
                  )}

                  {/* Model Information */}
                  {change.modelId && (
                    <div className="model-info flex items-center justify-between text-xs">
                      <span className="text-text-muted">AI Model:</span>
                      <span className="text-text font-mono">{change.modelId}</span>
                    </div>
                  )}

                  {/* Document ID */}
                  {change.documentId && (
                    <div className="document-info flex items-center justify-between text-xs">
                      <span className="text-text-muted">Document:</span>
                      <span className="text-text font-mono truncate ml-2 max-w-[120px]">
                        {change.documentId}
                      </span>
                    </div>
                  )}

                  {/* Compute Proof (Truncated) */}
                  {change.proof && (
                    <div className="proof-info">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-muted">Compute Proof:</span>
                      </div>
                      <code className="block p-2 bg-dark-lighter border border-border rounded text-xs text-text-muted font-mono break-all max-h-[60px] overflow-y-auto">
                        {change.proof}
                      </code>
                    </div>
                  )}

                  {/* Full Summary (if truncated in header) */}
                  {change.summary && change.summary.length > 80 && (
                    <div className="full-summary mt-2">
                      <p className="text-xs text-text leading-relaxed">{change.summary}</p>
                    </div>
                  )}

                  {/* Additional Metadata */}
                  <div className="additional-metadata grid grid-cols-2 gap-2 text-xs">
                    {change.requiresAI !== undefined && (
                      <div className="flex items-center gap-1">
                        <span className="text-text-muted">AI Analysis:</span>
                        <span className={change.requiresAI ? 'text-green-400' : 'text-text-muted'}>
                          {change.requiresAI ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    
                    {change.contentHash && (
                      <div className="col-span-2">
                        <span className="text-text-muted">Content Hash:</span>
                        <code className="block mt-1 p-1 bg-dark-lighter rounded text-xs text-text-muted font-mono truncate">
                          {change.contentHash}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Statistics Footer */}
      {changes.length > 0 && (
        <div className="change-statistics mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="text-center">
              <div className="text-text font-semibold">{changes.length}</div>
              <div className="text-text-muted">Total</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-semibold">
                {changes.filter(c => c.changeType === 'major').length}
              </div>
              <div className="text-text-muted">Major</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 font-semibold">
                {changes.filter(c => c.changeType === 'minor').length}
              </div>
              <div className="text-text-muted">Minor</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangeHistory;