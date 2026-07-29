// Unused — auth moved from phone+OTP to email+OTP (see migration 018 and
// /api/auth/check-email). Left commented rather than deleted in case phone
// login is ever revisited. With no exported handler, this route now 404s
// for any request rather than running stale phone-lookup logic.
export {};
//
// import { NextResponse } from "next/server";
// import { createServiceSupabase } from "@/lib/supabase/server";
// import { toE164 } from "@/lib/phone";
// import { withApiLogging } from "@/lib/apiLogger";
//
// export const POST = withApiLogging(
//   "/api/auth/check-phone",
//   async (req: Request) => {
//     const { phone: rawPhone } = (await req.json().catch(() => ({}))) as {
//       phone?: string;
//     };
//
//     if (!rawPhone) {
//       return NextResponse.json({ error: "Phone number required" }, { status: 400 });
//     }
//
//     const phone = toE164(rawPhone);
//     if (!/^\+91\d{10}$/.test(phone)) {
//       return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
//     }
//
//     const service = createServiceSupabase();
//
//     const phoneWithoutPlus = phone.replace("+", "");
//     const last10Digits = phone.slice(-10);
//
//     // 1. Check profiles table
//     const { data: profiles, error: profileErr } = await service
//       .from("profiles")
//       .select("id, full_name, phone")
//       .or(`phone.eq.${phone},phone.eq.${phoneWithoutPlus},phone.eq.${last10Digits}`)
//       .limit(10);
//
//     if (profileErr) {
//       return NextResponse.json({ error: profileErr.message }, { status: 500 });
//     }
//
//     const existingProfile = profiles?.find((p) => p.full_name && p.full_name.trim().length > 0);
//     if (existingProfile) {
//       return NextResponse.json({ exists: true });
//     }
//
//     // 2. Check auth.users table
//     const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
//     if (!listErr && list?.users) {
//       const existingAuthUser = list.users.find(
//         (u) => u.phone === phoneWithoutPlus || u.phone === phone
//       );
//
//       if (existingAuthUser) {
//         const { data: userProfile } = await service
//           .from("profiles")
//           .select("full_name")
//           .eq("id", existingAuthUser.id)
//           .maybeSingle();
//
//         if (userProfile?.full_name && userProfile.full_name.trim().length > 0) {
//           return NextResponse.json({ exists: true });
//         }
//       }
//     }
//
//     return NextResponse.json({ exists: false });
//   },
//   { rateLimit: "auth" }
// );
