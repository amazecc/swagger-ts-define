# Swagger TypeScript 类型生成

> 目前只支持 swagger3.0.0

## 安装

```sh
npm i swagger-ts-define -D

or

yarn add swagger-ts-define -D
```

## 配置

根目录创建 `swagger-ts-define.config.js`，进行配置

```javascript
const config = {
  /** swagger json schema 地址 */
  docUrl: 'http://example/docs-json',
  /** 类型输出目录，路径相对于根目录 */
  outputDir: 'api',
  /**
   * 对 api url 进行处理，该名称将会作为 interface 的名称前缀
   * @example /web/v1/user/list -> user/list -> interface UserListGetQuery {...}
   */
  getPath: (path) => path.match(/(?<=\/v1\/).+/)[0],
  /** api 调用方法方法来源，将会插入到文件首部 */
  requestFrom: 'import { request } from "src/utils/request";',
  /**
   * 针对 iso8601 时间格式字符串的自定义类型
   * @description 如果在 http 请求返回数据时统一做时间数据转换，比如统一转换为 Date 或者 Moment，那么可以在这里设置对应的类型
   */
  isoString: {
    typeName: 'string', // 'Moment'
    import: '', // 'import { Moment } from 'moment'
  },
};

module.exports = config;
```

## 运行

```sh
# 项目根目录执行
npx swagger-ts-define
```

## 类型说明

#### 类型命名规则

`url + method + (query/param/body/response)` 得到字符串后进行驼峰命名处理

- `url` 可通过配置文件中 `getPath` 方法进行处理，保留需要的信息
- `method` 为请求方式，get/post/delete...
- `query` 为 url 参数，例：/users?id=xxx
- `param` 为 path 参数，例：/users/{id}
- `body` 为请求体参数
- `response` 为返回值

1. 生成的类型分为四大类：`UrlGetQuery`,`UrlGetParam`,`UrlPostBody`,`UrlGetResponse`

2. 可自行封装通用 http 请求函数来使用以上生成的类型，在配置文件中配置 `requestFrom` 即可自动生成接口调用文件

   ```ts
   request(config: { query?: UrlGetQuery, param?: UrlGetParam, body?: UrlPostBody, url: string, method: string, ... }): Promise<UrlGetResponse>
   ```

#### 例子

1. GET /v1/users/{role}?name=xx

```ts
export interface V1UsersByRoleGetParam {
  // ...
}

export interface V1UsersByRoleGetQuery {
  // ...
}

export interface V1UsersByRoleGetResponse {
  // ...
}
```
