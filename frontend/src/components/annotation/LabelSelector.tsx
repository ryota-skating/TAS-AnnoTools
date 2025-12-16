/**
 * Label Selector Popup Component
 * 全55個のフィギュアスケート要素ラベルを検索・選択するポップアップ
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FIGURE_SKATING_ELEMENTS_ARRAY,
  type FigureSkatingElement,
  getElementById
} from '@shared/types/figure-skating';
import type { LabelSet } from '../../types/api';
import './LabelSelector.css';

interface LabelSelectorProps {
  isOpen: boolean;
  position: { x: number; y: number };
  currentLabel?: string;
  labelSet?: LabelSet | null;
  onSelect: (elementId: number) => void;
  onClose: () => void;
}

export function LabelSelector({
  isOpen,
  position,
  currentLabel,
  labelSet,
  onSelect,
  onClose
}: LabelSelectorProps) {


  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Convert labelSet items to full elements with names and categories
  const elements = useMemo(() => {
    if (!labelSet?.items) {
      return FIGURE_SKATING_ELEMENTS_ARRAY;
    }

    return labelSet.items
      .filter(item => item.enabled)
      .map(item => {
        // Try to get base element for existing IDs, but don't require it
        const baseElement = getElementById(item.elementId);

        // Create element object from labelSet data
        return {
          id: item.elementId,
          name: item.name || `Element_${item.elementId}`,
          category: item.category || 'Other',
          color: item.color,
          description: item.description || item.name?.replace(/_/g, ' ') || `Element ${item.elementId}`
        } as FigureSkatingElement;
      });
  }, [labelSet]);

  // フィルタリングされたラベル一覧
  const filteredElements = useMemo(() => {
    if (!searchTerm.trim()) {
      return elements;
    }

    const term = searchTerm.toLowerCase().replace(/[_]/g, ' ');
    return elements.filter(element => {
      // アンダースコアを半角スペースに変換して検索
      const displayName = element.name.replace(/[_]/g, ' ').toLowerCase();
      const description = element.description?.toLowerCase() || '';
      const category = element.category.replace(/[_]/g, ' ').toLowerCase();

      return displayName.includes(term) ||
             description.includes(term) ||
             category.includes(term);
    });
  }, [searchTerm, elements]);

  // ポップアップが開いたときの初期化
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      // 入力欄にフォーカス
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // 選択インデックスが変更されたときのスクロール調整
  useEffect(() => {
    if (listRef.current && filteredElements.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [selectedIndex, filteredElements]);

  // キーボードナビゲーション
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => 
            Math.min(prev + 1, filteredElements.length - 1)
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredElements[selectedIndex]) {
            handleSelectElement(filteredElements[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredElements, onClose]);

  // 要素選択ハンドラー
  const handleSelectElement = (element: FigureSkatingElement) => {
    onSelect(element.id);
    onClose();
  };

  // 検索入力変更ハンドラー
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setSelectedIndex(0); // 検索結果が変わったら選択を先頭にリセット
  };

  // クリックアウトサイドでクローズ
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isOpen && !target.closest('.label-selector-popup')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div className="label-selector-overlay" />
      
      {/* ポップアップ */}
      <div 
        className="label-selector-popup"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        {/* ヘッダー */}
        <div className="label-selector-header">
          <h3>ラベルを選択</h3>
          <button 
            className="label-selector-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* 検索ボックス */}
        <div className="label-selector-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="ラベル名を検索..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="label-selector-search-input"
          />
          <div className="label-selector-count">
            {filteredElements.length} / {elements.length} 件
          </div>
        </div>

        {/* ラベルリスト */}
        <div 
          ref={listRef}
          className="label-selector-list"
        >
          {filteredElements.map((element, index) => {
            const displayName = element.name.replace(/[_]/g, ' ');
            const isSelected = index === selectedIndex;
            const isCurrent = element.name === currentLabel;
            
            return (
              <div
                key={element.id}
                className={`label-selector-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                onClick={() => handleSelectElement(element)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div 
                  className="label-color-indicator"
                  style={{ backgroundColor: element.color }}
                />
                <div className="label-content">
                  <div className="label-name">{displayName}</div>
                  <div className="label-category">{element.category.replace(/[_]/g, ' ')}</div>
                </div>
                {isCurrent && (
                  <div className="label-current-indicator">現在</div>
                )}
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div className="label-selector-footer">
          <div className="label-selector-shortcuts">
            <span>↑↓ 選択 | Enter 決定 | Esc キャンセル</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default LabelSelector;