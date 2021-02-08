self.importScripts('https://cdn.bootcss.com/spark-md5/3.0.0/spark-md5.js');

self.onmessage = async (event) => {
    let { partList } = event.data;
    const spark = new self.SparkMD5.ArrayBuffer();
    let percent = 0; // 计算的百分比
    let perSize = 100 / partList.length; // 计算完一个是百分之多少
    // 封装成异步读取
    let buffers =await Promise.all(partList.map(({ chunk, size }) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(chunk);
            reader.onload = (readerEvent) => {
                percent += perSize;
                self.postMessage({ percent: Number(percent.toFixed(2)) });
                resolve(readerEvent.target.result);
            }
        });
    }));
    buffers.forEach(buffer => spark.append(buffer));
    self.postMessage({ percent: 100, hash : spark.end() });
    self.close();
}