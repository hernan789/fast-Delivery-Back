export interface CreateUserRequestBody {
  name: string;
  surname: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}


export interface Payload {
  name: string;
  surname: string;
  email: string;
  isAdmin: boolean;
}
