import { RequestBodyObject, Parameter } from './paths'
import { Schema } from './schema'

export interface Components {
  schemas: Record<string, Schema>
  requestBodies: Record<string, RequestBodyObject>
  parameters: Record<string, Parameter>
}
