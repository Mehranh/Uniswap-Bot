export class ResultWrapper<T> {
    constructor(result: T, success: boolean = undefined, message: string = undefined,error=undefined) {
        this.success = success !== undefined ? success : true;
        this.message = message;
        this.result = result;
        this.error = error;
    }

    result: T;
    message: string;
    success: boolean;
    error: any;
}
