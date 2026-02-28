import { Stage, Layer, Rect } from 'react-konva';

function EditorCanvas() {
  return (
    <Stage width={800} height={600}>
      <Layer>
        <Rect x={100} y={100} width={200} height={150} fill="blue" />
      </Layer>
    </Stage>
  );
}

export default EditorCanvas;
