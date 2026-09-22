export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: "admin" | "technician" | "viewer";
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: "admin" | "technician" | "viewer";
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: "admin" | "technician" | "viewer";
          created_at?: string;
        };
        Relationships: [];
      };
      machines: {
        Row: {
          id: string;
          machine_id: string;
          machine_name: string;
          machine_type: string;
          location: string;
          status: "Running" | "Stop" | "Alarm" | "Maintenance";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          machine_id: string;
          machine_name: string;
          machine_type?: string;
          location?: string;
          status?: "Running" | "Stop" | "Alarm" | "Maintenance";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          machine_id?: string;
          machine_name?: string;
          machine_type?: string;
          location?: string;
          status?: "Running" | "Stop" | "Alarm" | "Maintenance";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alarms: {
        Row: {
          id: string;
          machine_id: string;
          alarm_code: string;
          description: string;
          cause: string | null;
          status: "Open" | "In Progress" | "Closed";
          alarmed_at: string;
          created_at: string;
          updated_at: string;
          machines?: {
            machine_id?: string;
            machine_name?: string;
          } | null;
        };
        Insert: {
          id?: string;
          machine_id: string;
          alarm_code: string;
          description: string;
          cause?: string | null;
          status?: "Open" | "In Progress" | "Closed";
          alarmed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          machine_id?: string;
          alarm_code?: string;
          description?: string;
          cause?: string | null;
          status?: "Open" | "In Progress" | "Closed";
          alarmed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alarms_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          }
        ];
      };
      maintenance_records: {
        Row: {
          id: string;
          machine_id: string;
          maintenance_type: string;
          problem: string;
          action_taken: string | null;
          technician: string | null;
          status: "Pending" | "In Progress" | "Completed" | "Waiting Part";
          maintenance_date: string;
          created_at: string;
          updated_at: string;
          machines?: {
            machine_id?: string;
            machine_name?: string;
          } | null;
        };
        Insert: {
          id?: string;
          machine_id: string;
          maintenance_type: string;
          problem: string;
          action_taken?: string | null;
          technician?: string | null;
          status?: "Pending" | "In Progress" | "Completed" | "Waiting Part";
          maintenance_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          machine_id?: string;
          maintenance_type?: string;
          problem?: string;
          action_taken?: string | null;
          technician?: string | null;
          status?: "Pending" | "In Progress" | "Completed" | "Waiting Part";
          maintenance_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_records_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Machine = Database["public"]["Tables"]["machines"]["Row"];
export type Alarm = Database["public"]["Tables"]["alarms"]["Row"];
export type MaintenanceRecord =
  Database["public"]["Tables"]["maintenance_records"]["Row"];

export const MACHINE_STATUSES = [
  "Running",
  "Stop",
  "Alarm",
  "Maintenance",
] as const;

export const ALARM_STATUSES = ["Open", "In Progress", "Closed"] as const;

export const MAINTENANCE_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "Waiting Part",
] as const;