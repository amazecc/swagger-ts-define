const config = {
  docUrl: 'http://edc-test.youbaokeji.cn/docs-json',
  outputDir: 'api',
  getPath: (path) => path.match(/(?<=\/v1\/).+/)[0],
  requestFrom: 'import { request } from "src/utils/request";',
  isoString: {
    typeName: 'string',
    import: '',
  },
};

module.exports = config;
