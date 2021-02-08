import axios from './index';
import * as Types from "../Types/index";
// 文件请求上传

export function fileUpLoad(filePart: Blob, filename: string, chunkname: string, start:number,onUploadProgress:any,source:any) {
    return axios.post(`/upload/${filename}/${chunkname}/${start}`,filePart,{
        headers:{'Content-Type':'application/octet-stream'},
        onUploadProgress,
        cancelToken: source.token
    });
}

export function mergeFile(filename: string) {
   return axios.get(`/merge/${filename}`);
}

export function verifyFile(filename: string) {
    return axios.get<Types.verifyData,Types.verifyData>(`/verify/${filename}`);
}