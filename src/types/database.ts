// Database types based on the todos table schema
export type Todo = {
    id: number;
    text: string;
    done: boolean;
    user_id: string;
    created_at: string;
    updated_at: string;
  };
  
  export type TodoInsert = {
    text: string;
    user_id: string;
    done?: boolean;
  };
  
  export type TodoUpdate = {
    text?: string;
    done?: boolean;
  };
  
  // Server action response type
  export type ActionResponse<T = void> = {
    success: boolean;
    data?: T;
    error?: string;
  };