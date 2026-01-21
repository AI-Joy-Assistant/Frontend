import { createClient } from '@supabase/supabase-js';

// Hardcoded for migration - TODO: Move to .env
const supabaseUrl = 'https://kddihbrxlgrbgajqtpuk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkZGloYnJ4bGdyYmdhanF0cHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NjYwMTIsImV4cCI6MjA4NDU0MjAxMn0.Sa3yz-s6PUlgE0BfPVH3dRlIBJzV7r22fNZZ8BJLdx8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 