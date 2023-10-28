export class SignUpRequest {
    username: string;
    email: string;
    role: string;
    password: string;
  
    constructor(data: { username: string, email: string, role: string, password: string }) {
      this.username = data.username;
      this.email = data.email;
      this.role = data.role;
      this.password = data.password;
    }
  }
  