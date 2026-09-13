/**
 * 对象类型映射工具类
 * 负责Fabric对象类型和工具名称之间的映射
 */
export class ObjectTypeMapper {
    /**
     * 映射Fabric对象类型到工具名称
     */
    static mapObjectTypeToToolName(objectType) {
        switch (objectType) {
            case 'brush':
                return 'brush';
            case 'text':
                return 'text';
            case 'arrow':
                return 'arrow';
            case 'mosaic':
            case 'mosaic-path':
                return null; // 马赛克不显示子工具栏
            case 'rectangle':
            case 'circle':
            case 'ellipse':           // 椭圆
            case 'triangle':          // 三角形
            case 'diamond':           // 菱形
            case '5-gon':             // 五边形
            case '6-gon':             // 六边形
            case 'star':              // 星形
            case 'shape-arrow':       // 形状工具中的箭头形状
                return 'shape';
            case 'selection':
            default:
                return null; // 多选或未知类型
        }
    }

    /**
     * 映射工具名称到Fabric对象类型
     */
    static mapToolNameToObjectType(toolName) {
        switch (toolName) {
            case 'brush':
                return 'brush';
            case 'text':
                return 'text';
            case 'arrow':
                return 'arrow';
            case 'mosaic':
                return 'mosaic-path';
            case 'shape':
                return 'rectangle'; // 默认形状
            default:
                return null;
        }
    }

    /**
     * 判断对象类型是否为形状
     */
    static isShapeType(objectType) {
        const shapeTypes = [
            'rectangle', 'circle', 'ellipse', 'triangle', 
            'diamond', '5-gon', '6-gon', 'star', 'shape-arrow'
        ];
        return shapeTypes.includes(objectType);
    }

    /**
     * 判断对象类型是否需要显示子工具栏
     */
    static needsSubToolbar(objectType) {
        return this.mapObjectTypeToToolName(objectType) !== null;
    }

    /**
     * 获取所有支持的工具类型
     */
    static getAllToolNames() {
        return [
            'brush', 'text', 'arrow', 'mosaic', 'shape',
            'ocr', 'scrolling', 'pin-image'
        ];
    }

    /**
     * 获取所有形状类型
     */
    static getAllShapeTypes() {
        return [
            'rectangle', 'circle', 'ellipse', 'triangle',
            'diamond', '5-gon', '6-gon', 'star', 'shape-arrow'
        ];
    }
}

