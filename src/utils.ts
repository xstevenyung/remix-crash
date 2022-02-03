export class CORSHeaders extends Headers {
  constructor() {
    super();

    this.append("Access-Control-Allow-Origin", "*");

    this.append(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD"
    );

    this.append(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Authorization"
    );
  }
}

export class CORSResponse extends Response {
  constructor() {
    super(null, { status: 204, headers: new CORSHeaders() });
  }
}
