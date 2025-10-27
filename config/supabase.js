const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("SUPABASE_URL:", supabaseUrl ? "✅ Found" : "❌ Missing");
  console.error(
    "SUPABASE_SERVICE_KEY:",
    supabaseKey ? "✅ Found" : "❌ Missing"
  );
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
