import { requireTenant, errorResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireTenant(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") || "customers";

    let csvContent = "";
    let filename = "sample.csv";

    if (kind === "customers") {
      filename = "customers_sample.csv";
      csvContent = `phone,name,company,city,vip_tier,dietary_pref
+974 3311 2233,Ahmed Al-Thani,Al Thani Holdings,Doha,Gold,None
+974 5522 3344,Fatima Noor,Noor Medical,Al Wakrah,Silver,Halal
+974 6633 4455,Mohamed Rashid,Rashid Logistics,Al Khor,Bronze,Vegetarian
+974 7744 5566,Sarah Jenkins,International School,Doha,Platinum,Gluten-free
`;
    } else if (kind === "catalog") {
      filename = "catalog_sample.csv";
      csvContent = `category,name,aliases,description,price,unit,stock,available
Fruits,Fresh Red Apples,"apple, apples, seb",Crisp sweet organic apples,12.50,kg,100,true
Dairy,Organic Full Cream Milk,"milk, paal",Fresh farm milk 1L,8.00,litre,50,true
Bakery,Artisan Sourdough Bread,"bread, sourdough",Handmade crusty sourdough loaf,15.00,each,25,true
Beverages,Cold Pressed Orange Juice,"orange juice, juice",100% pure orange juice 500ml,14.00,each,0,false
`;
    } else {
      // knowledge table (e.g. delivery areas and fees)
      filename = "delivery_areas_sample.csv";
      csvContent = `zone_name,min_order_qar,delivery_fee_qar,estimated_minutes,areas_covered
Doha Central,50,10,30-45 mins,"West Bay, Al Sadd, Bin Mahmoud, Al Hilal"
Doha North,75,15,40-50 mins,"The Pearl, Lusail, Dafna, Onaiza"
Al Wakrah & Wukair,100,20,45-60 mins,"Al Wakrah Souq, Ezdan Village, Al Wukair"
Al Khor & North,150,30,60-90 mins,"Al Khor Town, Simaisma, Ras Laffan"
`;
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
