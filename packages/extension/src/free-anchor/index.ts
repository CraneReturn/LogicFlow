/**
 * 自由锚点（Free Anchor）扩展
 *
 * 为矩形节点提供自由锚点能力：鼠标悬停在节点边框的任意位置时，
 * 锚点会吸附到鼠标在边框上的投影点，而不是固定的四个方向。
 *
 * 使用方式：
 * ```js
 * import { FreeAnchor } from '@logicflow/extension'
 * lf.use(FreeAnchor)
 * // 注册后使用节点类型 'free-anchor-rect'
 * lf.render({
 *   nodes: [{ type: 'free-anchor-rect', x: 100, y: 100 }],
 * })
 * ```
 */
import {
  h,
  RectNode,
  RectNodeModel,
  LogicFlow,
  EventType,
  GraphModel,
} from '@logicflow/core'
import { observable, action } from 'mobx'

/**
 * 计算点在矩形边框上的最近投影点。
 * 若点在矩形内部，则投影到最近的边上；若在外部，则夹紧到最近角/边。
 */
function projectPointOnRectBorder(
  mx: number,
  my: number,
  cx: number,
  cy: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const halfW = width / 2
  const halfH = height / 2
  const left = cx - halfW
  const right = cx + halfW
  const top = cy - halfH
  const bottom = cy + halfH

  // 将点夹紧到矩形范围内
  const px = Math.max(left, Math.min(right, mx))
  const py = Math.max(top, Math.min(bottom, my))

  // 若点在矩形外部，夹紧后的点即为边框上的投影
  if (mx < left || mx > right || my < top || my > bottom) {
    return { x: px, y: py }
  }

  // 点在矩形内部，投影到最近的边
  const distLeft = px - left
  const distRight = right - px
  const distTop = py - top
  const distBottom = bottom - py
  const minDist = Math.min(distLeft, distRight, distTop, distBottom)

  if (minDist === distLeft) return { x: left, y: py }
  if (minDist === distRight) return { x: right, y: py }
  if (minDist === distTop) return { x: px, y: top }
  return { x: px, y: bottom }
}

export class FreeAnchorRectModel extends RectNodeModel {
  /** 当前自由锚点在画布坐标系的 x 坐标，null 表示锚点未激活 */
  @observable freeAnchorX: number | null = null
  /** 当前自由锚点在画布坐标系的 y 坐标，null 表示锚点未激活 */
  @observable freeAnchorY: number | null = null

  @action
  setFreeAnchor(x: number | null, y: number | null): void {
    this.freeAnchorX = x
    this.freeAnchorY = y
  }

  getDefaultAnchor() {
    const { freeAnchorX, freeAnchorY } = this
    if (freeAnchorX !== null && freeAnchorY !== null) {
      return [{ x: freeAnchorX, y: freeAnchorY, id: `${this.id}_free` }]
    }
    return []
  }
}

export class FreeAnchorRectView extends RectNode<{
  model: FreeAnchorRectModel
  graphModel: GraphModel
}> {
  /** 标记是否正在从本节点的自由锚点拖拽连线，防止 NODE_MOUSELEAVE 时提前清除锚点 */
  private _isFreeAnchorDragging = false

  componentDidMount() {
    const { graphModel } = this.props
    graphModel.eventCenter.on(
      EventType.ANCHOR_DRAGSTART,
      this.onAnchorDragStart,
    )
    graphModel.eventCenter.on(EventType.ANCHOR_DRAGEND, this.onAnchorDragEnd)
    graphModel.eventCenter.on(
      EventType.NODE_MOUSELEAVE,
      this.onNodeMouseLeave,
    )
  }

  componentWillUnmount() {
    const { graphModel } = this.props
    graphModel.eventCenter.off(
      EventType.ANCHOR_DRAGSTART,
      this.onAnchorDragStart,
    )
    graphModel.eventCenter.off(EventType.ANCHOR_DRAGEND, this.onAnchorDragEnd)
    graphModel.eventCenter.off(
      EventType.NODE_MOUSELEAVE,
      this.onNodeMouseLeave,
    )
  }

  private onAnchorDragStart = ({ nodeModel }: { nodeModel: { id: string } }) => {
    if (nodeModel === (this.props.model as unknown)) {
      this._isFreeAnchorDragging = true
    }
  }

  private onAnchorDragEnd = ({ nodeModel }: { nodeModel: { id: string } }) => {
    if (nodeModel === (this.props.model as unknown)) {
      this._isFreeAnchorDragging = false
      this.props.model.setFreeAnchor(null, null)
    }
  }

  private onNodeMouseLeave = ({ data }: { data: { id: string } }) => {
    const { model } = this.props
    if (data.id === model.id && !this._isFreeAnchorDragging) {
      model.setFreeAnchor(null, null)
    }
  }

  private onShapeMouseMove = (ev: MouseEvent) => {
    const { model, graphModel } = this.props
    const {
      canvasOverlayPosition: { x, y },
    } = graphModel.getPointByClient({ x: ev.clientX, y: ev.clientY })
    const borderPoint = projectPointOnRectBorder(
      x,
      y,
      model.x,
      model.y,
      model.width,
      model.height,
    )
    model.setFreeAnchor(borderPoint.x, borderPoint.y)
  }

  getShape(): h.JSX.Element | null {
    return h('g', { onMouseMove: this.onShapeMouseMove }, super.getShape())
  }
}

export const FreeAnchor = {
  pluginName: 'freeAnchor',
  install(lf: LogicFlow) {
    lf.register({
      type: 'free-anchor-rect',
      model: FreeAnchorRectModel,
      view: FreeAnchorRectView,
    })
  },
}

export default FreeAnchor
