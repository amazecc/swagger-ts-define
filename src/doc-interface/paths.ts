import { Schema } from './schema'

/**
 * @see https://swagger.io/docs/specification/describing-parameters/
 */

// NOTE: 不支持 Common Parameters

export type Paths = Record<string, Record<Method, OperationMetadata>>

export type Method = 'get' | 'delete' | 'head' | 'options' | 'post' | 'put' | 'patch' | 'purge' | 'link' | 'unlink'

export type MediaType = 'application/json' // TODO: 支持多种数据格式

export type ParameterLocation = 'query' | 'path'

export interface OperationMetadata {
  operationId: string
  /** 当前接口说明 */
  summary: string
  /** 参数列表 */
  parameters: Parameter[]
  /** 接口标签，作为api分类用，多个分类将转成字符串 */
  tags: string[]
  /** 请求携带的参数 */
  requestBody?: RequestBody
  /** api返回值 */
  responses: Responses
}

export interface Parameter {
  /** 参数字段名称 */
  name: string
  /** 参数位置 */
  in: ParameterLocation
  /** 参数详细定义 */
  schema: Schema
  /**
   * 是否为必填
   * @default false
   */
  required?: boolean

  /** 参数描述 */
  description?: string
  // NOTE: 没有处理 content ，此处只实现 schema
  /**
   * 允许无值，只有字段的情况
   * @example GET /foo?metadata
   */
  allowEmptyValue?: boolean
  /** 案例 */
  examples?: object
  /** 废弃 */
  deprecated?: boolean
}

export type RequestBody = RequestBodyObject | RequestBodyRef

export interface RequestBodyObject {
  content: BodyObjectContent
  /** body 的描述 */
  description?: string
  /** body 是否可选 */
  required?: boolean
}

export interface RequestBodyRef {
  $ref: `#/components/requestBodies/${string}`
}

export type BodyObjectContent = Record<MediaType, { schema: Schema }>

export interface ResponseBodyObject {
  content: BodyObjectContent
  /** body 的描述 */
  description?: string
}

// TODO: 完成其他 http code 的类型生成
export interface Responses {
  200: ResponseBodyObject
  [k: string]: any
}
