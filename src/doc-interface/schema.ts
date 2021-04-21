export type StringFormats = 'date-time' | (string & {})

export interface CommonData<T> {
  type: T
  /** 值是否可为 null */
  nullable?: boolean
  /** 字段描述 */
  description?: string
}

export interface StringSchema extends CommonData<'string'> {
  enum?: string[]
  /** 字符串格式 */
  format?: StringFormats
}

export interface NumberSchema extends CommonData<'number' | 'integer'> {
  enum?: number[]
  minimum?: number
  maximum?: number
  /** 排除最小值 */
  exclusiveMinimum?: boolean
  /** 排除最大值 */
  exclusiveMaximum?: boolean
  /** 必须是该数字的倍数 */
  multipleOf?: number
}

export interface BooleanSchema extends CommonData<'boolean'> {}

export interface ArraySchema extends CommonData<'array'> {
  items?: Schema
}

export interface ObjectSchema extends CommonData<'object'> {
  required?: string[]
  properties?: Record<string, Schema>
}

export interface RefSchema {
  $ref: `#/components/schemas/${string}`
}

/** 合并所有子集字段生成一个对象 */
export interface AllOfSchema {
  allOf: Schema[]
}

/** 取其中子集中一项作为 */
export interface OneOfSchema {
  oneOf: Schema[]
}

/** 满足子集一个或多个 */
export interface AnyOfSchema {
  anyOf: Schema[]
}

export type Schema = StringSchema | NumberSchema | BooleanSchema | ArraySchema | ObjectSchema | RefSchema | AllOfSchema | OneOfSchema | AnyOfSchema
