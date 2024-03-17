const { defineConfig } = require('@vue/cli-service')
const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: process.env.NODE_ENV === 'production'
    ? '/gpt' // Replace 'my-app' with the subdirectory name
    : '/',
    productionSourceMap: true, // Enable source map generation
    configureWebpack: {
      devtool: 'source-map',
      plugins: [
        // Add the obfuscator plugin only in production
        ...(process.env.NODE_ENV === 'production' ? [new JavaScriptObfuscator({
          rotateStringArray: true,
          sourceMap: true,
          sourceMapMode: 'separate',
          // additional options here
        }, [])] : [])
      ]
    }
})
