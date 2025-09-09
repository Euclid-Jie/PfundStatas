import pandas as pd
import sqlalchemy
from config import SQL_PASSWORDS, SQL_HOST
from AutoEmail import AutoEmail, EmailParams

engine = sqlalchemy.create_engine(
    f"mysql+pymysql://dev:{SQL_PASSWORDS}@{SQL_HOST}:3306?charset=utf8"
)
with engine.connect() as connection:
    bench_basic_data = pd.read_sql_query(
        f"""SELECT 
                managerName,
                YEAR(rpi.putOnRecordDate) AS year,
                MONTH(rpi.putOnRecordDate) AS month,
                COUNT(*) AS record_count
            FROM 
                UpdatedData.raw_pfund_info rpi
            WHERE 
                rpi.putOnRecordDate >= '2025-07-01' 
            GROUP BY 
                managerName, 
                YEAR(rpi.putOnRecordDate),
                MONTH(rpi.putOnRecordDate)
            ORDER BY record_count DESC""",
        engine,
    )
company_info = pd.read_sql_query("SELECT * FROM Euclid.量化私募管理人列表", engine)
bench_basic_data = bench_basic_data.merge(
    company_info[["协会名称", "管理人简称"]],
    how="left",
    left_on="managerName",
    right_on="协会名称",
)
bench_basic_data = bench_basic_data[bench_basic_data["管理人简称"].notna()]
del bench_basic_data["协会名称"]
del bench_basic_data["managerName"]
bench_basic_data = bench_basic_data.groupby(
    ["year", "month", "管理人简称"], as_index=False
)["record_count"].sum()
bench_basic_data.sort_values(
    by=["year", "month", "record_count"], ascending=[False, False, False], inplace=True
)
bench_basic_data.rename(columns={"管理人简称": "ManagerShortName"}, inplace=True)
bench_basic_data.to_json("data.json", orient="records", force_ascii=False, indent=4)

with engine.connect() as connection:
    p_info = pd.read_sql_query(
        f"""SELECT
            *
            from
                UpdatedData.raw_pfund_info rpi
            where
                rpi.putOnRecordDate >= "2025-07-01"
            order by
                rpi.putOnRecordDate""",
        engine,
    )
p_info.sort_values(by=["putOnRecordDate"], ascending=False)[
    [
        "fundNo",
        "fundName",
        "managerName",
        "managerType",
        "workingState",
        "putOnRecordDate",
        "mandatorName",
    ]
].to_json("monthlyData.json", orient="records", force_ascii=False, indent=4)

AutoEmail(
    EmailParams(
        title="PFund网页已更新", content="https://euclid-jie.github.io/PfundStatas/"
    )
)
