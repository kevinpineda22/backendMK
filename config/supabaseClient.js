// backend/config/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;

// Usamos una variable de entorno para la clave service_role
// Su valor debe ser la clave 'service_role | secret' de tu imagen.
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

// Creamos el cliente con la clave de Rol de Servicio.
// ESTE CLIENTE ACTÚA COMO ADMINISTRADOR y IGNORA EL RLS.
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default supabase;