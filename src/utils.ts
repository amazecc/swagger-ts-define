import * as prettier from 'prettier';
import * as fs from 'fs';
import * as path from 'path';

export const requireFromString = (src: string, filename = '') => {
  const Module = module.constructor as any;
  const m = new Module();
  m._compile(src, filename);
  return m.exports;
};

/** 将字符串转化为驼峰写法 */
export const camelCase = (str: string, firstLetterUpperCase = true) => {
  return str
    .split('-')
    .map((_, index) => _.replace(/^\w/, (item) => (firstLetterUpperCase ? item.toUpperCase() : index === 0 ? item.toLowerCase() : item.toUpperCase())))
    .join('');
};

/** 判断一个类型字符串(interface 字符串)是否全部为可选的 */
export const isAllOptional = (interfaceString: string) => !!interfaceString.match(/[\w]+\??:\s\w+/g)?.every((_) => _.includes('?'));

export const formatCode = (code: string) =>
  prettier.format(code, {
    ...JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '.prettierrc')).toString()),
    parser: 'typescript',
  });
