export interface Part{
    chunk:Blob;
    size:number;
    filename?:string;
    chunkname?:string;
    loaded?:number;
}

export interface upLoaded{
    filename:string;
    size: number // 目前上传的大小
}


export interface verifyData {
    needUpLoad:boolean;
    uploadList:upLoaded[]
}

export interface Result {
    success:boolean;
    needUpLoad: boolean;
    uploadList: upLoaded[];
}
