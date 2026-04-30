import React from 'react'
import { View, Text, ScrollView } from 'react-native'

export default function HowToPlaySection() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text
          style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}
        >
          ऑनलाइन मटका कैसे खेलें
        </Text>

        <Text style={{ fontSize: 16, lineHeight: 24, marginBottom: 12 }}>
          ऑनलाइन मटका खेलने के लिए सबसे पहले आपको हमारे पास पैसे डिपॉजिट करवाने होंगे। मटका खेलने के लिए न्यूनतम ₹500 डिपॉजिट करना अनिवार्य है, इससे कम राशि स्वीकार नहीं की जाएगी। जितनी राशि आप डिपॉजिट करेंगे, उतने ही पॉइंट आपकी USER ID में जोड़ दिए जाएंगे। उदाहरण के लिए, ₹500 डिपॉजिट करने पर 500 पॉइंट आपकी ID में ऐड हो जाएंगे।
        </Text>

        <Text
          style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#f1890b', marginBottom: 16 }}
        >
          500 rs =500 points
        </Text>

        <Text style={{ fontSize: 16, lineHeight: 24, marginBottom: 12 }}>
          डिपॉजिट सफल होने के बाद आपको एक नोटिफिकेशन प्राप्त होगा, जिसमें बताया जाएगा कि आपके द्वारा डिपॉजिट की गई राशि आपके वॉलेट में सफलतापूर्वक जोड़ दी गई है। इसके बाद आप अपनी पसंद का कोई भी मटका गेम खेल सकते हैं।
        </Text>

        <Text style={{ fontSize: 16, lineHeight: 24 }}>
          यदि आप गेम में जीत जाते हैं, तो जीती हुई राशि हमारे मटका रेट के अनुसार अपने-आप आपके वॉलेट में जोड़ दी जाएगी और आपका वॉलेट बैलेंस ऑटोमैटिक रूप से अपडेट हो जाएगा।
        </Text>
      </View>
    </ScrollView>
  )
}
