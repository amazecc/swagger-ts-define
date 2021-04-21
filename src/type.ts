import { Method } from './doc-interface/paths'

export interface RequestParam {
  /** 类型名称 */
  typeName: string
  required: boolean
}

export interface API {
  path: string
  name: string
  method: Method
  /** api 分类 */
  tags: string[]
  description: string
  /** url 上参数对应的类型名称 */
  param?: string
  query?: RequestParam
  body?: RequestParam
  /** 返回值类型名称 */
  response?: string
}
