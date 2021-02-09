<template>
  <div class="box">
    <div class="input_box">
      <input type="file" @change="onChange" />
    </div>
    <div class="button_box">
      <van-button
        :disabled="status === 1 || status === 2"
        class="but"
        type="primary"
        @click="upLoad"
        >上传</van-button
      >
      <van-button
        :disabled="status === 0 || status === 2"
        class="but"
        type="primary"
        @click="clickPause"
        >暂停</van-button
      >
      <van-button
        :disabled="status === 1 || status === 0"
        class="but"
        type="primary"
        @click="clickContinue"
        >继续</van-button
      >
    </div>
    <div class="progress-box">
      <van-progress :percentage="progress" />
    </div>
  </div>
</template>
<script lang="ts">
import axios from "@/api";
import { Notify } from "vant";
import { defineComponent, PropType, reactive, ref, toRefs, watch, watchEffect } from "vue";
import { fileUpLoad, mergeFile, verifyFile } from "../api/fileAPI";
import * as Types from "../Types/index";
export default defineComponent({
  name: "home",
  props: {},
  components: {},
  setup() {
    const currentFile = ref<File>();
    const source = ref<any>();
    let partList: Types.Part[] | null = null;
    const progressArr = ref<Map<number,number>>(new Map()); // 用来存放每个分块的进度
    const state = reactive({
      filename: "",
      totalSize: 0,
      progress: 0,
      currentUploadSize: 0,
      source,
      status: 0, // 0 初始化 1 上传中 2 停止
    });

    // 分片
    function createChunks(file: File): Types.Part[] {
      const SIZE = 1024 * 1024 * 100; // 默认100M
      const { size, name, type } = file;
      let current = 0;
      let partLists: Types.Part[] = [];
      // 进行切片
      while (current < size) {
        let chunk = file.slice(current, current + SIZE);
        partLists.push({ chunk, size: chunk.size });
        current += SIZE;
      }
      return partLists;
    }

    // 计算哈希 其实可以后端计算主要为了使用一下worker
    function calculateHash(partList: Types.Part[]) {
      return new Promise((resolve) => {
        let worker = new Worker("http://localhost:8080/hash.js");
        worker.postMessage({ partList });
        worker.onmessage = (event) => {
          let { percent, hash } = event.data;
          if (hash) {
            resolve(hash);
          }
        };
      });
    }

    // 发送上传请求
    async function handleUpLoad(partList: Types.Part[]) {
      let data = await verifyFile(state.filename); // 获取当前上传进度
      if (!data.needUpLoad) {
        state.progress = 100;
        state.status = 0;
        Notify({ type: "primary", message: "秒传成功！" });
        return;
      }
      // 过滤掉已经上传完成的
      partList = partList.filter((part) => {
        let currentFile = data.uploadList.find(
          (item) => item.filename === part.chunkname
        );
        // 如果当前的part不存在
        if (!currentFile) {
          part.loaded = 0;
          return true;
        }
        // 用于刷新以后 或者断点续传时保存当前已经上传的大小
        state.currentUploadSize += currentFile.size!;
        if (currentFile.size < part.size) {
          part.loaded = currentFile.size;
          return true;
        }
        return false;
      });
      // 用来取消请求
      const CancelToken = axios.CancelToken;
      state.source = CancelToken.source();
      return Promise.all(
        partList.map((item,index) => {
          return fileUpLoad(
            item.chunk.slice(item.loaded),
            item.filename!,
            item.chunkname!,
            item.loaded!,
            (progressEvent: any) => { // 处理进度条
              progressArr.value.set(index,progressEvent.loaded);
            },
            state.source
          );
        })
      );
    }
   // 处理进度条
    watch(progressArr,(newVal)=>{
      let sum = 0;
      let arr = Array.from(newVal);
      sum = arr.reduce((pre,cur)=>{
        return pre + cur[1];
      },0);
      if(sum == 0) return;
      sum += state.currentUploadSize;
      state.progress = Number((sum / state.totalSize).toFixed(2)) * 100;
    },{deep:true})

    // 上传
    async function upLoad() {
      if (!currentFile.value) {
        Notify({ type: "primary", message: "请选择文件" });
        return;
      }
      // 进度条归零
      progressArr.value.clear();
      state.currentUploadSize = 0;
      state.progress = 0;
      state.status = 1;
      // 分片
      partList = createChunks(currentFile.value!);
      // 计算哈希（为秒传提供支持）通过webworker计算
      let fileHash = await calculateHash(partList);
      let { name } = currentFile.value!;
      let DotIndex = name.lastIndexOf(".");
      let extName = name.slice(DotIndex);
      // 最后的文件名
      state.filename = `${fileHash}${extName}`;
      // 添加每个分块的名称
      partList.forEach((item, index) => {
        item.filename = state.filename;
        item.chunkname = `${state.filename}-${index}`;
      });
      try {
        let data = await handleUpLoad(partList);
        if (data) {
          await mergeFile(state.filename);
          state.status = 0;
          Notify({ type: "primary", message: "上传成功！" });
        }
      } catch (error) {
        console.log(error);
        Notify("暂停上传！");
      }
    }

    // 点击暂停
    function clickPause() {
      // 清空之前分片的进度
      progressArr.value.clear();
      
      state.status = 2;
      state.source.cancel("取消上传");
    }

    // 点击继续
    async function clickContinue() {
      try {
        state.status = 1;
        let data = await handleUpLoad(partList!);
        if (data) {
          await mergeFile(state.filename);
          state.status = 0;
          Notify({ type: "primary", message: "上传成功！" });
        }
      } catch (error) {
        console.log(error);
        Notify("暂停上传！");
      }
    }

    // 监听文件长传
    async function onChange(e: any) {
      state.status = 0;
      // 进度条归零
      progressArr.value.clear();
      state.currentUploadSize = 0;
      state.progress = 0;
      currentFile.value = e.target.files[0];
      // 存储总大小
      state.totalSize = currentFile.value?.size!;
    }

    // 控制进度条
    function onProgress(progressEvent: any) {
      state.progress = Number((progressEvent.loaded / progressEvent.total).toFixed(2)) * 100;
    }

    return {
      onChange,
      upLoad,
      clickPause,
      clickContinue,
      ...toRefs(state),
    };
  },
});
</script>
<style lang="scss">
.box {
  width: 500px;
  height: 500px;
  margin-top: 100px;
  margin: auto;
  padding-top: 50px;
}
.input_box {
  padding: 20px;
}
.button_box {
  width: 50%;
  display: flex;
  justify-content: space-around;
}
.progress-box {
  margin-top: 20px;
}
</style>
