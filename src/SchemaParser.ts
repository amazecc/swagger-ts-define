/**
 * 主要实现流程：
 * 1. 生成共享对象生成公共类型
 * 2. 递归处理 parameters 上的数据，主要包含 query 和 param(path 参数)，生成类型，有公用类型则指向公用类型名称，否则生成类型字符串
 * 3. 递归处理 request body 数据，生成类型，有公用类型则指向公用类型名称，否则生成类型字符串
 * 4. 递归处理 response 数据，生成类型，有公用类型则指向公用类型名称，否则生成类型字符串
 * 5. 遍历 paths 生成 api 描述数据数据
 */

import { Docs } from './doc-interface';
import { Method, OperationMetadata } from './doc-interface/paths';
import { ObjectSchema, Schema } from './doc-interface/schema';
import { API } from './type';
import { camelCase, isAllOptional } from './utils';

export interface FieldRecord {
  field: string;
  type: string;
  required: boolean;
  nullable: boolean;
  description: string;
}

export interface SchemaParserOptions {
  isoStringTypeName: string;
  /** 处理 path，该 path 用于接口（interface）名称 */
  getPath: (patch: string) => string;
}

export class SchemaParser {
  readonly #docs: Docs;
  readonly #options?: SchemaParserOptions;
  /** 所有类型名字 -> 类型字符串 */
  types: Record<string, string | undefined> = {};
  /** 所有 api 列表 */
  apis: API[] = [];

  constructor(docs: Docs, options?: SchemaParserOptions) {
    this.#docs = docs;
    this.#options = options;
  }

  /** 创建 interface 字符串 */
  private createInterfaceString = (name: string, fields: FieldRecord[]) => {
    return `
	   export interface ${name} {
		   ${fields
         .map((_) => {
           return `
		 ${_.description ? `/** ${_.description} */` : ''}
		 ${_.field}${!_.required ? '?' : ''}: ${_.type}${_.nullable ? ' | null' : ''};`;
         })
         .join('')}
	   }
	   `;
  };

  /** 生成带有继承关系的类型字符串 */
  private createExtendsInterfaceString(interfaceName: string, extendsInterfaces: string[]) {
    return `export interface ${interfaceName}${extendsInterfaces.length > 0 ? ` extends ${extendsInterfaces.join(',')}` : ''} {}`;
  }

  /** 创建 type 类型个别名字符串 */
  private createTypeAliasString(name: string, childTypes: (number | string)[], description?: string) {
    return `
	 ${description ? `/** ${description} */` : ''}
	 export type ${name} = ${childTypes.map((_) => (typeof _ === 'number' ? _ : `${_}`)).join('|')};
	 `;
  }

  /** 将 api path 和 请求方式组合生成 api 名称 */
  private mapApiPathToApiName(apiPath: string) {
    const path = this.#options?.getPath?.(apiPath) ?? apiPath;
    return path
      .split('/')
      .map((_) => (/{[a-zA-Z]+}/.test(_) ? `By${camelCase(_.slice(1, -1))}` : camelCase(_)))
      .join('');
  }

  /** 过滤得到合法的 schema */
  private getLegalSchema(schemas: Schema[]) {
    return schemas.filter((schema) => {
      return 'type' in schema || '$ref' in schema || 'allOf' in schema || 'oneOf' in schema || 'oneOf' in schema;
    });
  }

  private getTypeNameFromSchema(interfaceName: string, fieldName: string, schema: Schema): string {
    if ('allOf' in schema) {
      const interfaceNames = this.getLegalSchema(schema.allOf).map((_) => this.getTypeNameFromSchema(interfaceName, fieldName, _));
      const allOfTypeName = camelCase(`${interfaceName}-${fieldName}`);
      this.types[allOfTypeName] = this.createExtendsInterfaceString(allOfTypeName, interfaceNames);
      return allOfTypeName;
    }
    if ('anyOf' in schema) {
      const interfaceNames = this.getLegalSchema(schema.anyOf).map((_) => this.getTypeNameFromSchema(interfaceName, fieldName, _));
      const anyOfTypeName = camelCase(`${interfaceName}-${fieldName}`);
      const allOfTypeName = camelCase(`${anyOfTypeName}-allOf`);
      this.types[allOfTypeName] = this.createExtendsInterfaceString(allOfTypeName, interfaceNames);
      this.types[anyOfTypeName] = this.createTypeAliasString(anyOfTypeName, interfaceNames.concat(allOfTypeName));
      return anyOfTypeName;
    }
    if ('oneOf' in schema) {
      const interfaceNames = this.getLegalSchema(schema.oneOf).map((_) => this.getTypeNameFromSchema(interfaceName, fieldName, _));
      const oneOfTypeName = camelCase(`${interfaceName}-${fieldName}`);
      this.types[oneOfTypeName] = this.createTypeAliasString(oneOfTypeName, interfaceNames);
      return oneOfTypeName;
    }
    if ('$ref' in schema) {
      const data = schema.$ref.split('/');
      return data[data.length - 1];
    }
    if ('type' in schema) {
      switch (schema.type) {
        case 'boolean':
          return 'boolean';
        case 'integer':
        case 'number': {
          if (schema.enum) {
            const nextInterfaceName = camelCase(`${interfaceName}-${fieldName}-union`);
            this.types[nextInterfaceName] = this.createTypeAliasString(nextInterfaceName, schema.enum, schema.description);
            return nextInterfaceName;
          }
          return 'number';
        }
        case 'string': {
          if (schema.enum) {
            const nextInterfaceName = camelCase(`${interfaceName}-${fieldName}-union`);
            this.types[nextInterfaceName] = this.createTypeAliasString(
              nextInterfaceName,
              schema.enum.map((_) => `'${_}'`),
              schema.description,
            );
            return nextInterfaceName;
          }
          if (schema.format === 'date-time') {
            return this.#options?.isoStringTypeName || 'string';
          }
          return 'string';
        }
        case 'array':
          if (!schema.items) {
            return 'any[]'; // NOTE: 数组没有写明每一项的类型，则返回 any[]
          }
          const nextInterfaceName = camelCase(`${interfaceName}-${fieldName}-item`);
          return `${this.getTypeNameFromSchema(nextInterfaceName, 'item', schema.items)}[]`;
        case 'object':
          if (schema.properties) {
            const nextInterfaceName = camelCase(`${interfaceName}-${fieldName}`);
            this.createInterfaceStringFormObjectSchema(nextInterfaceName, schema);
            return nextInterfaceName;
          }
          // NOTE: 如果不存在 properties 则代表后端返回的数据是一个不固定的值
          return 'object';
      }
    }
    throw new Error('数据异常1');
  }

  private createInterfaceStringFormObjectSchema(interfaceName: string, fieldRecord: ObjectSchema) {
    if (fieldRecord.properties) {
      this.types[interfaceName] = this.createInterfaceString(
        interfaceName,
        Object.entries(fieldRecord.properties).map((_) => {
          let nullable = false;
          let description = '';
          if ('allOf' in _[1] || 'anyOf' in _[1] || 'oneOf' in _[1] || '$ref' in _[1]) {
            nullable = false;
          }
          if ('type' in _[1]) {
            nullable = !!_[1].nullable;
            description = _[1].description ?? '';
          }
          const typeName = this.getTypeNameFromSchema(interfaceName, _[0], _[1]);
          return {
            field: _[0],
            type: typeName,
            required: !!fieldRecord.required?.includes(_[0]),
            nullable,
            description,
          };
        }),
      );
    }
  }

  /** 创建所有的类型相关信息 */
  private createAllTypeData() {
    this.createCommonTypes(this.#docs.components.schemas);
    Object.entries(this.#docs.paths).forEach(([path, operationMetadataMap]) => {
      Object.keys(operationMetadataMap).forEach((m) => {
        const method = m as Method;
        const interfaceName = camelCase(`${this.mapApiPathToApiName(path)}-${method}`);
        const operationMetadata = operationMetadataMap[method];
        this.createQueryAndParamTypes(interfaceName, operationMetadata);
        this.createBodyTypes(interfaceName, operationMetadata);
        this.createResponseTypes(interfaceName, operationMetadata);
        this.createAPIs(path, method, operationMetadata);
      });
    });
  }

  /** 解析 components/schema 下的公共数据生成类型 */
  private createCommonTypes(schemaMap: Record<string, Schema>) {
    Object.entries(schemaMap).forEach(([key, schema]) => {
      this.getTypeNameFromSchema('', key, schema);
    });
  }

  /** 解析 query 和 param 的类型 */
  private createQueryAndParamTypes(interfaceName: string, operationMetadata: OperationMetadata) {
    const query: FieldRecord[] = [];
    const param: FieldRecord[] = [];
    operationMetadata.parameters
      .filter((_) => _.in === 'path' || _.in === 'query')
      .forEach((_) => {
        const nextInterfaceName = camelCase(`${interfaceName}-${_.in}`);
        const record: FieldRecord = {
          field: _.name,
          type: this.getTypeNameFromSchema(nextInterfaceName, _.name, _.schema),
          required: _.required ?? false,
          nullable: false,
          description: _.description ?? '',
        };
        if (_.in === 'query') {
          query.push(record);
        } else {
          param.push(record);
        }
      });
    const queryTypeName = camelCase(`${interfaceName}-query`);
    const paramTypeName = camelCase(`${interfaceName}-param`);
    if (query.length > 0) {
      this.types[queryTypeName] = this.createInterfaceString(queryTypeName, query);
    }
    if (param.length > 0) {
      this.types[paramTypeName] = this.createInterfaceString(paramTypeName, param);
    }
  }

  /** 解析 body 类型 */
  private createBodyTypes(interfaceName: string, operationMetadata: OperationMetadata) {
    if (operationMetadata.requestBody) {
      if ('$ref' in operationMetadata.requestBody) {
        // TODO:在 requestBodies 中，公共区域
        throw new Error('request body 使用了公用部分，请补充');
      }
      const schema = operationMetadata.requestBody?.content?.['application/json']?.schema;
      if (schema) {
        const typeName = this.getTypeNameFromSchema(interfaceName, 'body', schema);
        const bodyInterfaceName = camelCase(`${interfaceName}-body`);
        this.types[bodyInterfaceName] = this.createTypeAliasString(bodyInterfaceName, [typeName]);
      }
    }
  }

  /** 解析 response 类型 */
  private createResponseTypes(interfaceName: string, operationMetadata: OperationMetadata) {
    const schema = operationMetadata.responses?.[200]?.content?.['application/json']?.schema;
    if (schema) {
      this.getTypeNameFromSchema(interfaceName, 'response', schema);
    }
  }

  /** 生成接口并添加到 this.APIList */
  private createAPIs(path: string, method: Method, operationMetadata: OperationMetadata) {
    const pathName = this.mapApiPathToApiName(path);
    const paramInterfaceName = camelCase(`${pathName}-${method}-param`);
    const queryInterfaceName = camelCase(`${pathName}-${method}-query`);
    const bodyInterfaceName = camelCase(`${pathName}-${method}-body`);
    const responseInterfaceName = camelCase(`${pathName}-${method}-response`);
    const apiListItem: API = {
      path,
      name: camelCase(`${pathName}-${method}`, false),
      method,
      /** api 分类 */
      tags: operationMetadata.tags,
      description: operationMetadata.summary,
      /** url 上参数对应的类型名称 */
      param: this.types[paramInterfaceName] && paramInterfaceName,
      query: this.types[queryInterfaceName]
        ? {
            required: !isAllOptional(this.types[queryInterfaceName]!),
            typeName: queryInterfaceName,
          }
        : undefined,
      body: this.types[bodyInterfaceName]
        ? {
            required: !isAllOptional(this.types[bodyInterfaceName]!),
            typeName: bodyInterfaceName,
          }
        : undefined,
      /** 返回值类型名称 */
      response: this.types[responseInterfaceName] && responseInterfaceName,
    };
    this.apis.push(apiListItem);
  }

  /** 开始解析 */
  parse() {
    if (this.#docs.openapi !== '3.0.0') {
      throw new Error('只支持 swagger v3.0.0');
    }
    this.createAllTypeData();
  }
}
