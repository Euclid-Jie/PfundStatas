// 加载各家总数数据并填充表格
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const tbody = document.querySelector('#managerTable tbody');
        data.forEach(item => {
            const row = `<tr><td>${item.year}</td><td>${item.month}</td><td>${item.managerName}</td><td>${item.record_count}</td></tr>`;
            tbody.innerHTML += row;
        });
    });

// 查询指定公司当月数据，并以表格形式展示
function queryCompanyData() {
    const company = document.getElementById('companyInput').value;
    fetch('monthlyData.json')
        .then(response => response.json())
        .then(data => {
            const results = data.filter(item => 
                item.managerName.includes(company) && 
                new Date(Number(item.putOnRecordDate)).getMonth() === new Date().getMonth()
            );
            const resultsDiv = document.getElementById('queryResults');
            if (results.length === 0) {
                resultsDiv.innerHTML = "<p>未查询到相关数据</p>";
                return;
            }
            let tableHtml = `
                <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>基金编码</th>
                            <th>基金名称</th>
                            <th>管理人名称</th>
                            <th>管理人类型</th>
                            <th>运作状态</th>
                            <th>备案日期</th>
                            <th>委托人名称</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            tableHtml += results.map(item => {
                // 转换 putOnRecordDate 为 yyyy-MM-dd 格式
                let date = '';
                if (item.putOnRecordDate) {
                    const d = new Date(Number(item.putOnRecordDate));
                    date = d.toISOString().split('T')[0];
                }
                return `
                    <tr>
                        <td>${item.fundNo || ''}</td>
                        <td>${item.fundName || ''}</td>
                        <td>${item.managerName || ''}</td>
                        <td>${item.managerType || ''}</td>
                        <td>${item.workingState || ''}</td>
                        <td>${date}</td>
                        <td>${item.mandatorName || ''}</td>
                    </tr>
                `;
            }).join('');
            tableHtml += `
                    </tbody>
                </table>
            `;
            resultsDiv.innerHTML = tableHtml;
        });
}
