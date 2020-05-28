const site_config = {
    'notice': '', //公告内容，留空则不显示
    'code_store_link': 'https://google.com', //小店链接
    'line1': '欢迎使用 Office',
    'line2': '你可在这里创作、沟通、协作并完成重要工作。',
    'code_api_link': ''
};

const ms_config = {
    'tenant_id': '5eaf8f20-13e1-454e-b955-8992dd213927',
    'client_id': 'e9fcf945-32fd-4f7e-aded-756049f7d8e2',
    'client_secret': '5cbZ6tuCg48yFN.TWUI15Un-G-OHg~_p6_',
    'subscription': {
        'name': 'A1',
        'skuId': '94763226-9b3c-4e75-a931-5c89701abe66'
    },
    'domains': ['outgianthard.onmicrosoft.com', 'edede.edu']
};

const recaptcha_config = {
    'site_key': '6Lf3NskUAAAAALT16dmqviBch3FR3wyZssYj67sU',
    'secret_key': '6Lf3NskUAAAAAJsczgsy5ECM10M_a_LcYQxzz1mz'
};



function enQuery(data) {
    const ret = [];
    for (let d in data) {
        ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
    }
    return ret.join("&");
}

function password_gen() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = 8;
    var randomstring = '';
    var charCount = 0;
    var numCount = 0;

    for (var i = 0; i < string_length; i++) {
        // If random bit is 0, there are less than 3 digits already saved, and there are not already 5 characters saved, generate a numeric value. 
        if ((Math.floor(Math.random() * 2) == 0) && numCount < 3 || charCount >= 5) {
            var rnum = Math.floor(Math.random() * 10);
            randomstring += rnum;
            numCount += 1;
        } else {
            // If any of the above criteria fail, go ahead and generate an alpha character from the chars string
            var rnum = Math.floor(Math.random() * chars.length);
            randomstring += chars.substring(rnum, rnum + 1);
            charCount += 1;
        }
    }
    return randomstring;
}

async function validateRecaptcha(token) {
    const url = 'https://www.google.com/recaptcha/api/siteverify';
    const post_data = {
        secret: recapctha_config.secret_key,
        response: token
    };
    const reqOpt = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: enQuery(post_data)
    };
    const response = await fetch(url, reqOpt);
    const results = await response.json();
    console.log('validateRecaptcha ' + results.success);
    return results.success;
}

async function get_ms_token() {
    const url = 'https://login.microsoftonline.com/' + ms_config.tenant_id + '/oauth2/v2.0/token';
    const scope = 'https://graph.microsoft.com/.default';

    const post_data = {
        'grant_type': 'client_credentials',
        'client_id': ms_config.client_id,
        'client_secret': ms_config.client_secret,
        'scope': scope
    };
    const reqOpt = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: enQuery(post_data)
    };
    const response = await fetch(url, reqOpt);
    const results = await response.json();
    console.log(results);
    return results.access_token;
}

async function assignLicense(userEmail, access_token, requestBody) {
    const url = 'https://graph.microsoft.com/v1.0/users/' + userEmail + '/assignLicense';
    const post_data = {
        "addLicenses": [{
            "disabledPlans": [],
            "skuId": ms_config.subscription.skuId
        }],
        "removeLicenses": []
    };
    const reqOpt = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(post_data)
    };
    const response = await fetch(url, reqOpt);
    const results = await response.json();
    console.log('assignLicense ' + results);

    if (results.error == undefined) {
        return true;
    } else {
        return false;
    }
}

async function createUser(requestBody, access_token) {
    const url = 'https://graph.microsoft.com/v1.0/users';
    const password = password_gen();
    const userEmail = requestBody.username + '@' + requestBody.domain
    const post_data = {
        "accountEnabled": true,
        "displayName": requestBody.displayname,
        "mailNickname": requestBody.username,
        "passwordPolicies": "DisablePasswordExpiration, DisableStrongPassword",
        "passwordProfile": {
            "password": password,
            "forceChangePasswordNextSignIn": true
        },
        "userPrincipalName": userEmail,
        "usageLocation": "CN"
    };
    console.log('createUser data ' + post_data);
    const reqOpt = {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Bearer ' + access_token
        },
        body: JSON.stringify(post_data)
    };
    const response = await fetch(url, reqOpt);
    const results = await response.json();
    console.log(results);
    if (results.error != undefined) {
        if (results.error.message == 'Another object with the same value for property userPrincipalName already exists.') {
            return {
                stat: 'username exists'
            };
        }
        return results;
    }

    if (await assignLicense(userEmail, access_token, requestBody)) {
        const account = {
            stat: 'success',
            email: userEmail,
            password: password
        };
        return account;
    } else {
        const account = {
            stat: JSON.stringify(assign_results)
        };
        return account;
    }
}

async function validateCode(code) {
    const response = await fetch(site_config.code_api_link, {
        method: 'POST',
        body: JSON.stringify({
            'action': 'checkCode',
            'code': code
        })
    });
    return await response.json();
}

async function deleteCode(code) {
    const response = await fetch(site_config.code_api_link, {
        method: 'POST',
        body: JSON.stringify({
            'action': 'delCode',
            'code': code
        })
    });
    return await response.text();
}

function myInterpolate(params, text) {
    for (key of Object.keys(params)) {
        text = text.replace('${' + key + '}', params[key])
    }
    return text;
}

async function handleRequest(request) {

    var requestUrl = new URL(request.url);
    var requestPath = requestUrl.pathname;

    switch (requestPath) {
        case '/mscreate':
            if (request.method == 'POST') {
                const requestBody = await request.json();

                if (!await validateRecaptcha(requestBody.grecaptcha_token)) {
                    return new Response(JSON.stringify({
                        stat: 'wrong recaptcha'
                    }));
                }

                if (await validateCode(requestBody.code)) {

                    const ms_token = await get_ms_token();
                    const account = await createUser(requestBody, ms_token);

                    if (account.stat == 'success') {
                        await deleteCode(requestBody.code);
                    }

                    return new Response(JSON.stringify(account));
                } else {
                    return new Response(JSON.stringify({
                        'stat': 'invalid code'
                    }));
                }

            }
            break;
        default:
            var resposne = await fetch('https://cdn.jsdelivr.net/gh/zayabighead/msautocreate@master/index.htm');
            var html = await resposne.text();

            var html_subscription = `<option value="${ms_config.subscription.name}">${ms_config.subscription.name}</option>`;
            var html_domains = '';
            for (var domain of ms_config.domains) {
                html_domains += `<option value="${domain}">@ ${domain}</option>`;
            }

            return new Response(myInterpolate({
                notice: site_config.notice,
                line1: site_config.line1,
                line2: site_config.line2,
                subscription: html_subscription,
                domains: html_domains,
                code_store_link: site_config.code_store_link,
                recaptcha_sitekey: recaptcha_config.site_key
            }, html), {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8"
                }
            });
    }

}

addEventListener('fetch', event => {
    return event.respondWith(handleRequest(event.request))
})
