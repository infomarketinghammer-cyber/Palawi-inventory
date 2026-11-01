import { getSession } from "@/lib/auth";
import { xlsxResponse } from "@/lib/xlsx";

/** Blank gate register template in the client's own column layout. */
export async function GET() {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  return xlsxResponse("gate-register-template.xlsx", [], ["Sr No.", "Time", "Visitor Name", "Date of Birth", "Mobile No.", "Address", "REMARKS", "Extra Remark", "Visit No"], []);
}
