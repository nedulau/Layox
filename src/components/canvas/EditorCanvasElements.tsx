import { Image as KonvaImage, Rect, Text, Transformer } from 'react-konva';
import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import type {
  ImageElement,
  PageElement,
  TextElement,
} from '../../types';
import { useCachedBlobImage } from './useAssetImage';

function ImageElementComponent({
  element,
  assetBlobs,
  projectId,
  isSelected,
  onSelect,
  onChange,
}: {
  element: ImageElement;
  assetBlobs: Record<string, Blob>;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<ImageElement>) => void;
}) {
  const image = useCachedBlobImage(projectId, element.src, assetBlobs);
  const shapeRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    onChange({
      x: Math.round(event.target.x()),
      y: Math.round(event.target.y()),
    });
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
          ref={transformerRef}
          rotateEnabled
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => (
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          )}
        />
      )}
    </>
  );
}

function TextElementComponent({
  element,
  isSelected,
  onSelect,
  onChange,
  onStartEdit,
  onDragMove,
  isEditing,
}: {
  element: TextElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<TextElement>) => void;
  onStartEdit: () => void;
  onDragMove?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  isEditing?: boolean;
}) {
  const shapeRef = useRef<Konva.Text>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    onChange({
      x: Math.round(event.target.x()),
      y: Math.round(event.target.y()),
    });
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

  if (isEditing) return null;

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
        align={element.align ?? 'left'}
        fontStyle={element.fontStyle ?? 'normal'}
        lineHeight={element.lineHeight ?? 1.2}
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onDragMove={onDragMove}
        onTransformEnd={handleTransformEnd}
        onDblClick={onStartEdit}
        onDblTap={onStartEdit}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={['middle-left', 'middle-right']}
          boundBoxFunc={(oldBox, newBox) => (
            newBox.width < 20 ? oldBox : newBox
          )}
        />
      )}
    </>
  );
}

export function ElementRenderer({
  element,
  assetBlobs,
  projectId,
  isSelected,
  onSelect,
  onChange,
  onStartEdit,
  onDragMove,
  isEditing,
}: {
  element: PageElement;
  assetBlobs: Record<string, Blob>;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<PageElement>) => void;
  onStartEdit?: () => void;
  onDragMove?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  isEditing?: boolean;
}) {
  if (element.type === 'image') {
    return (
      <ImageElementComponent
        element={element}
        assetBlobs={assetBlobs}
        projectId={projectId}
        isSelected={isSelected}
        onSelect={onSelect}
        onChange={onChange}
      />
    );
  }
  return (
    <TextElementComponent
      element={element}
      isSelected={isSelected}
      onSelect={onSelect}
      onChange={onChange}
      onStartEdit={onStartEdit ?? (() => {})}
      onDragMove={onDragMove}
      isEditing={isEditing}
    />
  );
}
