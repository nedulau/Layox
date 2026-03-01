import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva';
import { useEffect, useRef, useState, useCallback } from 'react';
import type Konva from 'konva';
import useProjectStore from '../../store/useProjectStore';
import type { ImageElement, TextElement, PageElement } from '../../types';

// ─── Image element ───────────────────────────────────────────────────────────

function ImageElementComponent({
  element,
  assetBlobs,
  isSelected,
  onSelect,
  onChange,
}: {
  element: ImageElement;
  assetBlobs: Record<string, Blob>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<ImageElement>) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const blob = assetBlobs[element.src];
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [element.src, assetBlobs]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.round(node.width() * scaleX),
      height: Math.round(node.height() * scaleY),
      rotation: Math.round(node.rotation()),
    });
  };

  if (!image) {
    return (
      <Rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill="#555"
        rotation={element.rotation}
        onClick={onSelect}
        onTap={onSelect}
      />
    );
  }

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}

// ─── Text element ────────────────────────────────────────────────────────────

function TextElementComponent({
  element,
  isSelected,
  onSelect,
  onChange,
}: {
  element: TextElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<TextElement>) => void;
}) {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      fontSize: Math.round(element.fontSize * scaleX),
      width: Math.round(node.width() * scaleX),
      rotation: Math.round(node.rotation()),
    });
  };

  const handleDblClick = () => {
    const newText = prompt('Text bearbeiten:', element.content);
    if (newText !== null) {
      onChange({ content: newText });
    }
  };

  return (
    <>
      <Text
        ref={shapeRef}
        x={element.x}
        y={element.y}
        text={element.content}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.color}
        width={element.width}
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={['middle-left', 'middle-right']}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}

// ─── Element renderer ────────────────────────────────────────────────────────

function ElementRenderer({
  element,
  assetBlobs,
  isSelected,
  onSelect,
  onChange,
}: {
  element: PageElement;
  assetBlobs: Record<string, Blob>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<PageElement>) => void;
}) {
  switch (element.type) {
    case 'image':
      return (
        <ImageElementComponent
          element={element}
          assetBlobs={assetBlobs}
          isSelected={isSelected}
          onSelect={onSelect}
          onChange={onChange}
        />
      );
    case 'text':
      return (
        <TextElementComponent
          element={element}
          isSelected={isSelected}
          onSelect={onSelect}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

function EditorCanvas() {
  const currentPage = useProjectStore((s) => s.project.pages[s.currentPageIndex]);
  const assetBlobs = useProjectStore((s) => s.assetBlobs);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const setSelectedElementId = useProjectStore((s) => s.setSelectedElementId);
  const updateElement = useProjectStore((s) => s.updateElement);

  const elements = currentPage?.elements ?? [];
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Clicked on empty area → deselect
      if (e.target === e.target.getStage()) {
        setSelectedElementId(null);
      }
    },
    [setSelectedElementId],
  );

  return (
    <Stage width={800} height={600} onClick={handleStageClick} onTap={handleStageClick}>
      <Layer>
        {/* Page background */}
        <Rect x={0} y={0} width={800} height={600} fill={currentPage?.background ?? '#ffffff'} />
        {/* Render elements */}
        {sortedElements.map((el) => (
          <ElementRenderer
            key={el.id}
            element={el}
            assetBlobs={assetBlobs}
            isSelected={selectedElementId === el.id}
            onSelect={() => setSelectedElementId(el.id)}
            onChange={(changes) => updateElement(el.id, changes)}
          />
        ))}
      </Layer>
    </Stage>
  );
}

export default EditorCanvas;
