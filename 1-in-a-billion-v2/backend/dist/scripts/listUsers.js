"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabaseClient_1 = require("../services/supabaseClient");
async function main() {
    const serviceClient = (0, supabaseClient_1.createSupabaseServiceClient)();
    const { data, error } = await serviceClient.auth.admin.listUsers();
    console.log("Users:", data?.users?.length);
    if (error)
        console.error(error);
}
main();
//# sourceMappingURL=listUsers.js.map