#!/usr/bin/env node

/**
 * 主要实现流程：
 * 1. 生成共享对象生成公共类型
 * 2. 递归处理 parameters 上的数据，主要包含 query 和 param(path 参数)，生成类型，有公用类型则指向公用类型名称，否则生成类型字符串
 * 3. 递归处理 request body 数据，生成类型，有公用类型则指向公用类型名称，否则生成类型字符串
 * 4. 递归处理 response 数据，生成类型，有公用类型则指向公用类型名称，否则生成类型字符串
 * 5. 遍历 paths 生成 api 描述数据数据
 * 6. 根据 api 描述数据生成 api 调用方法
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import fetch from 'node-fetch';
import groupby from 'lodash.groupby';
import { Docs } from './doc-interface';
import { API } from './type';
import { formatCode, requireFromString } from './utils';
import { SchemaParser } from './SchemaParser';

export interface Options {
  docUrl: string;
  outputDir: string;
  getPath: (path: string) => string;
  requestForm: string;
  isoString: {
    typeName: string;
    import: string;
  };
}

const cwd = process.cwd();

const options: Options = requireFromString(fs.readFileSync(path.resolve(cwd, 'swagger-ts-define.config.js')).toString());

const outputDir = path.resolve(cwd, options.outputDir);

/** 写入所有的 api,字段的类型 */
const createAPIType = (types: Record<string, string | undefined>) => {
  const mainCode = Object.values(types).join('\n');
  const code = `
	${mainCode.includes(options.isoString.typeName) ? options.isoString.import : ''}
	
	${mainCode}
	`;
  fs.writeFileSync(path.resolve(cwd, outputDir, 'api.ts'), formatCode(code));
};
/** 生成并写入所有的 api 调用方法寄文件 */
const createAPIService = (apis: API[]) => {
  const ajaxString = options.requestForm.match(/{([\w\s]+)}/)![1].trim();
  Object.entries(groupby(apis, (item) => item.tags[0])).forEach(([tag, apis]) => {
    // 该分类的接口所有用到的类型
    const requestTypes: (string | undefined)[] = [];
    // 所有接口字符串
    const apisStringArray: string[] = [];
    apis.forEach((api) => {
      const paramString = api.param ? `param: ${api.param}` : '';
      const queryString = api.query ? `query${api.query.required ? '' : '?'}: ${api.query.typeName}` : '';
      const bodyString = api.body ? `body${api.body.required ? '' : '?'}: ${api.body.typeName}` : '';
      const responseType = api.response ? `Promise<${api.response}>` : 'Promise<void>';
      requestTypes.push(...[api.query?.typeName, api.param, api.body?.typeName, api.response].filter(Boolean));
      const fnParamsString = [paramString, queryString, bodyString].filter(Boolean).join(',');
      const fnParamsArray = fnParamsString.match(/\b(query|body|param)(?=(\??:))/g);
      apisStringArray.push(`
			  ${api.description ? `/** ${api.description} */` : ''}
			  export const ${api.name} = (${fnParamsString}): ${responseType} => ${ajaxString}({ method: "${api.method}", url: "${api.path}", ${fnParamsArray ? fnParamsArray.join(',') : ''} });
			  `);
    });
    const code = `
		  ${options.requestForm}
		  ${requestTypes.length > 0 ? `import { ${requestTypes.join(',')} } from "./api";` : ''}
 
		  ${apisStringArray.join('\n')}
		  `;
    fs.writeFileSync(path.resolve(cwd, outputDir, `${tag.toLowerCase()}.ts`), formatCode(code));
  });
};

/** 获取 swagger json schema 数据 */
const getSchema = async (url: string): Promise<Docs> => {
  const result = await fetch(url);
  return await result.json();
};

/** 开始任务 */
const run = async () => {
  const docs = await getSchema(options.docUrl);
  const parser = new SchemaParser((docs as unknown) as Docs, { getPath: (path) => path.match(/(?<=\/v1\/).+/)![0], isoStringTypeName: options.isoString.typeName });
  parser.parse();
  fs.ensureDir(outputDir);
  createAPIType(parser.types);
  createAPIService(parser.apis);
};

run();
