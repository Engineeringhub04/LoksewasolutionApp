// Generated only from /home/ubuntu/upload/pasted_content.txt; do not invent or edit question content here.
export type AdditionalFeatureId = 'gk' | 'pm';
export interface AdditionalFeatureQuestion { questionId: string; order: number; difficulty: 'easy' | 'medium' | 'hard'; question: string; options: { id: string; text: string }[]; correctOption: number; explanation: string }
export interface AdditionalFeatureTopic { topicId: string; titleEn: string; titleNp: string; slug: string; featureId: AdditionalFeatureId; questions: AdditionalFeatureQuestion[] }

export const ADDITIONAL_FEATURE_SEED_DATA: Record<AdditionalFeatureId, AdditionalFeatureTopic[]> = {
  "gk": [
    {
      "titleEn": "Geography Set 1",
      "titleNp": "भूगोल सेट १",
      "slug": "geography-set-1",
      "featureId": "gk",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Mount Everest || सगरमाथा"
            },
            {
              "id": "2",
              "text": "Mount Kanchenjunga || कञ्चनजङ्घा"
            },
            {
              "id": "3",
              "text": "Mount Dhaulagiri || धौलागिरी"
            },
            {
              "id": "4",
              "text": "Mount Manaslu || मनास्लु"
            }
          ],
          "difficulty": "easy",
          "question": "Which is the highest mountain in Nepal? || नेपालको सबैभन्दा अग्लो हिमाल कुन हो ?",
          "correctOption": 1,
          "explanation": "Mount Everest is the highest mountain in Nepal and the world. || सगरमाथा नेपालको र विश्वकै सबैभन्दा अग्लो हिमाल हो।",
          "questionId": "gk-topic-001-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Koshi River || कोशी नदी"
            },
            {
              "id": "2",
              "text": "Gandaki River || गण्डकी नदी"
            },
            {
              "id": "3",
              "text": "Karnali River || कर्णाली नदी"
            },
            {
              "id": "4",
              "text": "Bagmati River || बागमती नदी"
            }
          ],
          "difficulty": "medium",
          "question": "Which is the longest river in Nepal? || नेपालको सबैभन्दा लामो नदी कुन हो ?",
          "correctOption": 3,
          "explanation": "The Karnali is the longest river of Nepal. || कर्णाली नदी नेपालको सबैभन्दा लामो नदी हो।",
          "questionId": "gk-topic-001-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Dolpa || डोल्पा"
            },
            {
              "id": "2",
              "text": "Humla || हुम्ला"
            },
            {
              "id": "3",
              "text": "Taplejung || ताप्लेजुङ"
            },
            {
              "id": "4",
              "text": "Mustang || मुस्ताङ"
            }
          ],
          "difficulty": "hard",
          "question": "Which district is the largest in Nepal by area? || क्षेत्रफलका आधारमा नेपालको सबैभन्दा ठूलो जिल्ला कुन हो ?",
          "correctOption": 1,
          "explanation": "Dolpa is the largest district of Nepal by area. || क्षेत्रफलका आधारमा डोल्पा नेपालको सबैभन्दा ठूलो जिल्ला हो।",
          "questionId": "gk-topic-001-q-003"
        }
      ],
      "topicId": "gk-topic-001"
    },
    {
      "titleEn": "Geography Set 2",
      "titleNp": "भूगोल सेट २",
      "slug": "geography-set-2",
      "featureId": "gk",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "5 || ५"
            },
            {
              "id": "2",
              "text": "6 || ६"
            },
            {
              "id": "3",
              "text": "7 || ७"
            },
            {
              "id": "4",
              "text": "8 || ८"
            }
          ],
          "difficulty": "easy",
          "question": "How many provinces are there in Nepal? || नेपालमा कति वटा प्रदेश छन् ?",
          "correctOption": 3,
          "explanation": "Nepal has seven provinces. || नेपालमा सात वटा प्रदेश छन्।",
          "questionId": "gk-topic-002-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Rara Lake || रारा ताल"
            },
            {
              "id": "2",
              "text": "Phewa Lake || फेवा ताल"
            },
            {
              "id": "3",
              "text": "Tilicho Lake || तिलिचो ताल"
            },
            {
              "id": "4",
              "text": "Begnas Lake || बेगनास ताल"
            }
          ],
          "difficulty": "medium",
          "question": "Which is the largest lake of Nepal? || नेपालको सबैभन्दा ठूलो ताल कुन हो ?",
          "correctOption": 1,
          "explanation": "Rara Lake is the largest lake of Nepal by area. || क्षेत्रफलका आधारमा रारा ताल नेपालको सबैभन्दा ठूलो ताल हो।",
          "questionId": "gk-topic-002-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Solukhumbu || सोलुखुम्बु"
            },
            {
              "id": "2",
              "text": "Dolakha || दोलखा"
            },
            {
              "id": "3",
              "text": "Rasuwa || रसुवा"
            },
            {
              "id": "4",
              "text": "Sankhuwasabha || सङ्खुवासभा"
            }
          ],
          "difficulty": "hard",
          "question": "Which district is known as the gateway to Mount Everest? || कुन जिल्लालाई सगरमाथाको प्रवेशद्वार भनेर चिनिन्छ ?",
          "correctOption": 1,
          "explanation": "Solukhumbu is the main gateway to Mount Everest. || सोलुखुम्बु सगरमाथाको प्रमुख प्रवेशद्वार हो।",
          "questionId": "gk-topic-002-q-003"
        }
      ],
      "topicId": "gk-topic-002"
    },
    {
      "titleEn": "History, Religion and Culture Set 1",
      "titleNp": "इतिहास धर्म र संस्कृति सेट १",
      "slug": "history-religion-culture-set-1",
      "featureId": "gk",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Gautama Buddha || गौतम बुद्ध"
            },
            {
              "id": "2",
              "text": "Mahavira || महावीर"
            },
            {
              "id": "3",
              "text": "Ashoka || अशोक"
            },
            {
              "id": "4",
              "text": "Janaka || जनक"
            }
          ],
          "difficulty": "easy",
          "question": "Who founded Buddhism? || बौद्ध धर्मका संस्थापक को हुन् ?",
          "correctOption": 1,
          "explanation": "Gautama Buddha founded Buddhism. || गौतम बुद्धले बौद्ध धर्मको स्थापना गरेका हुन्।",
          "questionId": "gk-topic-003-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Dashain || दशैं"
            },
            {
              "id": "2",
              "text": "Tihar || तिहार"
            },
            {
              "id": "3",
              "text": "Holi || होली"
            },
            {
              "id": "4",
              "text": "Teej || तीज"
            }
          ],
          "difficulty": "medium",
          "question": "Which festival is known as the festival of lights in Nepal? || नेपालमा कुन पर्वलाई बत्तीको पर्व भनिन्छ ?",
          "correctOption": 2,
          "explanation": "Tihar is widely known as the festival of lights. || तिहारलाई बत्तीहरूको पर्वका रूपमा चिनिन्छ।",
          "questionId": "gk-topic-003-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Janakpur || जनकपुर"
            },
            {
              "id": "2",
              "text": "Kathmandu || काठमाडौं"
            },
            {
              "id": "3",
              "text": "Bhaktapur || भक्तपुर"
            },
            {
              "id": "4",
              "text": "Gorkha || गोरखा"
            }
          ],
          "difficulty": "hard",
          "question": "Which ancient city is associated with King Janak? || कुन प्राचीन सहर राजा जनकसँग सम्बन्धित छ ?",
          "correctOption": 1,
          "explanation": "Janakpur is traditionally associated with King Janak and the ancient Mithila kingdom. || जनकपुर परम्परागत रूपमा राजा जनक तथा प्राचीन मिथिला राज्यसँग सम्बन्धित छ।",
          "questionId": "gk-topic-003-q-003"
        }
      ],
      "topicId": "gk-topic-003"
    },
    {
      "titleEn": "History, Religion and Culture Set 2",
      "titleNp": "इतिहास धर्म र संस्कृति सेट २",
      "slug": "history-religion-culture-set-2",
      "featureId": "gk",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Dashain || दशैं"
            },
            {
              "id": "2",
              "text": "Tihar || तिहार"
            },
            {
              "id": "3",
              "text": "Buddha Jayanti || बुद्ध जयन्ती"
            },
            {
              "id": "4",
              "text": "Losar || ल्होसार"
            }
          ],
          "difficulty": "easy",
          "question": "Which festival is mainly celebrated by Hindus as the victory of good over evil? || हिन्दू धर्मावलम्बीहरूले असत्यमाथि सत्यको विजयका रूपमा मुख्यतः कुन पर्व मनाउँछन् ?",
          "correctOption": 1,
          "explanation": "Dashain symbolizes the victory of good over evil. || दशैंले असत्यमाथि सत्यको विजयको प्रतीक जनाउँछ।",
          "questionId": "gk-topic-004-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Lumbini || लुम्बिनी"
            },
            {
              "id": "2",
              "text": "Janakpur || जनकपुर"
            },
            {
              "id": "3",
              "text": "Pashupatinath || पशुपतिनाथ"
            },
            {
              "id": "4",
              "text": "Muktinath || मुक्तिनाथ"
            }
          ],
          "difficulty": "medium",
          "question": "Which place is famous as the birthplace of Gautama Buddha? || गौतम बुद्धको जन्मस्थलका रूपमा प्रसिद्ध स्थान कुन हो ?",
          "correctOption": 1,
          "explanation": "Lumbini is recognized as the birthplace of Gautama Buddha. || लुम्बिनी गौतम बुद्धको जन्मस्थलका रूपमा परिचित छ।",
          "questionId": "gk-topic-004-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Pagoda style || प्यागोडा शैली"
            },
            {
              "id": "2",
              "text": "Gothic style || गोथिक शैली"
            },
            {
              "id": "3",
              "text": "Roman style || रोमन शैली"
            },
            {
              "id": "4",
              "text": "Baroque style || बारोक शैली"
            }
          ],
          "difficulty": "hard",
          "question": "Which traditional architecture is especially associated with the Kathmandu Valley? || काठमाडौं उपत्यकासँग विशेष रूपमा सम्बन्धित परम्परागत वास्तुकला कुन हो ?",
          "correctOption": 1,
          "explanation": "Pagoda-style architecture is a prominent feature of the traditional architecture of the Kathmandu Valley. || प्यागोडा शैली काठमाडौं उपत्यकाको परम्परागत वास्तुकलाको प्रमुख विशेषता हो।",
          "questionId": "gk-topic-004-q-003"
        }
      ],
      "topicId": "gk-topic-004"
    },
    {
      "titleEn": "History of Nepal",
      "titleNp": "नेपालको इतिहास",
      "slug": "history-of-nepal",
      "featureId": "gk",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Prithvi Narayan Shah || पृथ्वीनारायण शाह"
            },
            {
              "id": "2",
              "text": "Jung Bahadur Rana || जङ्गबहादुर राणा"
            },
            {
              "id": "3",
              "text": "Tribhuvan || त्रिभुवन"
            },
            {
              "id": "4",
              "text": "Mahendra || महेन्द्र"
            }
          ],
          "difficulty": "easy",
          "question": "Who is known as the founder of modern Nepal? || आधुनिक नेपालको संस्थापक भनेर कसलाई चिनिन्छ ?",
          "correctOption": 1,
          "explanation": "Prithvi Narayan Shah unified many small states and laid the foundation of modern Nepal. || पृथ्वीनारायण शाहले धेरै साना राज्यहरूलाई एकीकरण गरी आधुनिक नेपालको आधार तयार गरे।",
          "questionId": "gk-topic-005-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Malla dynasty || मल्ल वंश"
            },
            {
              "id": "2",
              "text": "Rana dynasty || राणा वंश"
            },
            {
              "id": "3",
              "text": "Kirat dynasty || किराँत वंश"
            },
            {
              "id": "4",
              "text": "Licchavi dynasty || लिच्छवि वंश"
            }
          ],
          "difficulty": "medium",
          "question": "Which dynasty ruled Nepal before the Shah dynasty? || शाह वंशभन्दा अगाडि नेपालमा कुन वंशले शासन गरेको थियो ?",
          "correctOption": 1,
          "explanation": "The Malla dynasty ruled Kathmandu Valley before the Shah dynasty unified Nepal. || शाह वंशले नेपाल एकीकरण गर्नुअघि काठमाडौं उपत्यकामा मल्ल वंशले शासन गरेको थियो।",
          "questionId": "gk-topic-005-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "1903 BS || १९०३ साल"
            },
            {
              "id": "2",
              "text": "1905 BS || १९०५ साल"
            },
            {
              "id": "3",
              "text": "1910 BS || १९१० साल"
            },
            {
              "id": "4",
              "text": "1920 BS || १९२० साल"
            }
          ],
          "difficulty": "hard",
          "question": "In which year did the Kot Massacre take place? || कोत पर्व कुन सालमा भएको थियो ?",
          "correctOption": 1,
          "explanation": "The Kot Massacre took place in 1903 BS and played a major role in the rise of Jung Bahadur Rana. || कोत पर्व १९०३ सालमा भएको थियो र यसले जङ्गबहादुर राणाको उदयमा महत्वपूर्ण भूमिका खेलेको थियो।",
          "questionId": "gk-topic-005-q-003"
        }
      ],
      "topicId": "gk-topic-005"
    },
    {
      "titleEn": "Science and Technology Set",
      "titleNp": "विज्ञान तथा प्रविधि सेट",
      "slug": "science-and-technology-set",
      "featureId": "gk",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Venus || शुक्र"
            },
            {
              "id": "2",
              "text": "Mars || मंगल"
            },
            {
              "id": "3",
              "text": "Jupiter || बृहस्पति"
            },
            {
              "id": "4",
              "text": "Saturn || शनि"
            }
          ],
          "difficulty": "easy",
          "question": "Which planet is known as the Red Planet? || कुन ग्रहलाई रातो ग्रह भनिन्छ ?",
          "correctOption": 2,
          "explanation": "Mars appears reddish because of iron oxide on its surface. || मंगल ग्रहको सतहमा रहेको फलामको अक्साइडका कारण यो रातो देखिन्छ।",
          "questionId": "gk-topic-006-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Volt || भोल्ट"
            },
            {
              "id": "2",
              "text": "Watt || वाट"
            },
            {
              "id": "3",
              "text": "Ampere || एम्पियर"
            },
            {
              "id": "4",
              "text": "Ohm || ओम"
            }
          ],
          "difficulty": "medium",
          "question": "What is the SI unit of electric current? || विद्युत् धाराको SI एकाइ के हो ?",
          "correctOption": 3,
          "explanation": "Ampere is the SI unit of electric current. || एम्पियर विद्युत् धाराको SI एकाइ हो।",
          "questionId": "gk-topic-006-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Bluetooth || ब्लुटुथ"
            },
            {
              "id": "2",
              "text": "GPS || जीपीएस"
            },
            {
              "id": "3",
              "text": "HDMI || एचडीएमआई"
            },
            {
              "id": "4",
              "text": "Ethernet || इथरनेट"
            }
          ],
          "difficulty": "hard",
          "question": "Which technology is primarily used to connect devices over a short distance wirelessly? || छोटो दूरीमा उपकरणहरूलाई ताररहित रूपमा जोड्न मुख्यतः कुन प्रविधि प्रयोग गरिन्छ ?",
          "correctOption": 1,
          "explanation": "Bluetooth is a wireless technology designed for short-range communication between devices. || ब्लुटुथ उपकरणहरूबीच छोटो दूरीको ताररहित सञ्चारका लागि प्रयोग हुने प्रविधि हो।",
          "questionId": "gk-topic-006-q-003"
        }
      ],
      "topicId": "gk-topic-006"
    }
  ],
  "pm": [
    {
      "titleEn": "Public Administration",
      "titleNp": "सार्वजनिक प्रशासन",
      "slug": "public-administration",
      "featureId": "pm",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Public service delivery || सार्वजनिक सेवा प्रवाह"
            },
            {
              "id": "2",
              "text": "Private profit || निजी नाफा"
            },
            {
              "id": "3",
              "text": "Personal benefit || व्यक्तिगत लाभ"
            },
            {
              "id": "4",
              "text": "Business expansion || व्यापार विस्तार"
            }
          ],
          "difficulty": "easy",
          "question": "What is the main objective of public administration? || सार्वजनिक प्रशासनको मुख्य उद्देश्य के हो ?",
          "correctOption": 1,
          "explanation": "Public administration primarily aims to provide services and implement public policies for citizens. || सार्वजनिक प्रशासनको मुख्य उद्देश्य नागरिकलाई सेवा प्रदान गर्नु र सार्वजनिक नीतिहरू कार्यान्वयन गर्नु हो।",
          "questionId": "pm-topic-007-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Legislature || व्यवस्थापिका"
            },
            {
              "id": "2",
              "text": "Executive || कार्यपालिका"
            },
            {
              "id": "3",
              "text": "Judiciary || न्यायपालिका"
            },
            {
              "id": "4",
              "text": "Media || सञ्चारमाध्यम"
            }
          ],
          "difficulty": "medium",
          "question": "Which branch of government mainly implements laws and policies? || सरकारको कुन अंगले मुख्य रूपमा कानून तथा नीतिहरू कार्यान्वयन गर्छ ?",
          "correctOption": 2,
          "explanation": "The executive branch is primarily responsible for implementing laws and government policies. || कार्यपालिका कानून तथा सरकारी नीतिहरू कार्यान्वयन गर्न मुख्य रूपमा जिम्मेवार हुन्छ।",
          "questionId": "pm-topic-007-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Centralization || केन्द्रीकरण"
            },
            {
              "id": "2",
              "text": "Decentralization || विकेन्द्रीकरण"
            },
            {
              "id": "3",
              "text": "Privatization || निजीकरण"
            },
            {
              "id": "4",
              "text": "Globalization || विश्वव्यापीकरण"
            }
          ],
          "difficulty": "hard",
          "question": "Which principle emphasizes decisions being made as close as possible to citizens? || निर्णयहरू नागरिकको सबैभन्दा नजिकको तहबाट गरिनुपर्छ भन्ने सिद्धान्त कुन हो ?",
          "correctOption": 2,
          "explanation": "Decentralization distributes authority to lower levels of government and brings decision-making closer to citizens. || विकेन्द्रीकरणले अधिकार तल्लो तहमा बाँडफाँड गरी निर्णय प्रक्रियालाई नागरिकको नजिक पुर्‍याउँछ।",
          "questionId": "pm-topic-007-q-003"
        }
      ],
      "topicId": "pm-topic-007"
    },
    {
      "titleEn": "Management",
      "titleNp": "व्यवस्थापन",
      "slug": "management",
      "featureId": "pm",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Planning || योजना"
            },
            {
              "id": "2",
              "text": "Controlling || नियन्त्रण"
            },
            {
              "id": "3",
              "text": "Staffing || कर्मचारी व्यवस्था"
            },
            {
              "id": "4",
              "text": "Directing || निर्देशन"
            }
          ],
          "difficulty": "easy",
          "question": "Which is the first function of management? || व्यवस्थापनको पहिलो कार्य कुन हो ?",
          "correctOption": 1,
          "explanation": "Planning is generally considered the first function of management because it sets objectives and determines how to achieve them. || योजनाले उद्देश्य निर्धारण गरी ती उद्देश्य प्राप्त गर्ने तरिका तय गर्ने भएकाले यसलाई व्यवस्थापनको पहिलो कार्य मानिन्छ।",
          "questionId": "pm-topic-008-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Planning || योजना"
            },
            {
              "id": "2",
              "text": "Organizing || संगठन"
            },
            {
              "id": "3",
              "text": "Controlling || नियन्त्रण"
            },
            {
              "id": "4",
              "text": "Staffing || कर्मचारी व्यवस्था"
            }
          ],
          "difficulty": "medium",
          "question": "Which management function involves comparing actual performance with planned performance? || वास्तविक कार्यसम्पादनलाई योजनाबद्ध कार्यसम्पादनसँग तुलना गर्ने व्यवस्थापनको कार्य कुन हो ?",
          "correctOption": 3,
          "explanation": "Controlling involves measuring performance and comparing it with planned standards. || नियन्त्रण कार्यमा कार्यसम्पादन मापन गरी योजनाबद्ध मापदण्डसँग तुलना गरिन्छ।",
          "questionId": "pm-topic-008-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Unity of command || आदेशको एकता"
            },
            {
              "id": "2",
              "text": "Division of work || कार्य विभाजन"
            },
            {
              "id": "3",
              "text": "Equity || समानता"
            },
            {
              "id": "4",
              "text": "Discipline || अनुशासन"
            }
          ],
          "difficulty": "hard",
          "question": "Which management principle states that an employee should receive orders from only one superior? || कर्मचारीले केवल एक जना उच्च अधिकारीबाट मात्र आदेश प्राप्त गर्नुपर्छ भन्ने व्यवस्थापनको सिद्धान्त कुन हो ?",
          "correctOption": 1,
          "explanation": "Unity of command means that each employee should receive orders from only one superior. || आदेशको एकता भन्नाले प्रत्येक कर्मचारीले केवल एक जना उच्च अधिकारीबाट मात्र आदेश प्राप्त गर्नुपर्छ भन्ने हो।",
          "questionId": "pm-topic-008-q-003"
        }
      ],
      "topicId": "pm-topic-008"
    },
    {
      "titleEn": "Organization and Organizational Behavior",
      "titleNp": "संगठन तथा संगठनात्मक व्यवहार",
      "slug": "organization-and-organizational-behavior",
      "featureId": "pm",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "A group working toward common objectives || साझा उद्देश्य प्राप्त गर्न काम गर्ने समूह"
            },
            {
              "id": "2",
              "text": "A single individual || एक जना व्यक्ति"
            },
            {
              "id": "3",
              "text": "A temporary meeting || अस्थायी बैठक"
            },
            {
              "id": "4",
              "text": "A personal activity || व्यक्तिगत क्रियाकलाप"
            }
          ],
          "difficulty": "easy",
          "question": "What is an organization? || संगठन भनेको के हो ?",
          "correctOption": 1,
          "explanation": "An organization is a group of people working together to achieve common objectives. || संगठन भनेको साझा उद्देश्य प्राप्त गर्न मिलेर काम गर्ने व्यक्तिहरूको समूह हो।",
          "questionId": "pm-topic-009-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Human behavior in organizations || संगठनभित्रको मानवीय व्यवहार"
            },
            {
              "id": "2",
              "text": "Machine design || मेसिन डिजाइन"
            },
            {
              "id": "3",
              "text": "Financial accounting only || केवल वित्तीय लेखांकन"
            },
            {
              "id": "4",
              "text": "Building construction || भवन निर्माण"
            }
          ],
          "difficulty": "medium",
          "question": "What does organizational behavior mainly study? || संगठनात्मक व्यवहारले मुख्य रूपमा केको अध्ययन गर्छ ?",
          "correctOption": 1,
          "explanation": "Organizational behavior studies how individuals and groups behave within organizations. || संगठनात्मक व्यवहारले संगठनभित्र व्यक्ति तथा समूहले गर्ने व्यवहारको अध्ययन गर्छ।",
          "questionId": "pm-topic-009-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Line organization || रेखीय संगठन"
            },
            {
              "id": "2",
              "text": "Matrix organization || म्याट्रिक्स संगठन"
            },
            {
              "id": "3",
              "text": "Informal organization || अनौपचारिक संगठन"
            },
            {
              "id": "4",
              "text": "Committee organization || समिति संगठन"
            }
          ],
          "difficulty": "hard",
          "question": "Which structure has a clear vertical chain of authority? || स्पष्ट ठाडो अधिकार शृङ्खला भएको संगठनात्मक संरचना कुन हो ?",
          "correctOption": 1,
          "explanation": "Line organization has a direct and clear vertical chain of authority. || रेखीय संगठनमा अधिकारको प्रत्यक्ष र स्पष्ट ठाडो शृङ्खला हुन्छ।",
          "questionId": "pm-topic-009-q-003"
        }
      ],
      "topicId": "pm-topic-009"
    },
    {
      "titleEn": "Office Management",
      "titleNp": "कार्यालय व्यवस्थापन",
      "slug": "office-management",
      "featureId": "pm",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Efficient office operation || कार्यालयको प्रभावकारी सञ्चालन"
            },
            {
              "id": "2",
              "text": "Increasing personal expenses || व्यक्तिगत खर्च बढाउनु"
            },
            {
              "id": "3",
              "text": "Reducing communication || सञ्चार घटाउनु"
            },
            {
              "id": "4",
              "text": "Avoiding records || अभिलेख नराख्नु"
            }
          ],
          "difficulty": "easy",
          "question": "What is the main purpose of office management? || कार्यालय व्यवस्थापनको मुख्य उद्देश्य के हो ?",
          "correctOption": 1,
          "explanation": "Office management aims to ensure efficient and smooth operation of office activities. || कार्यालय व्यवस्थापनको उद्देश्य कार्यालयका गतिविधिहरूलाई प्रभावकारी र सुचारु रूपमा सञ्चालन गर्नु हो।",
          "questionId": "pm-topic-010-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Filing system || फाइलिङ प्रणाली"
            },
            {
              "id": "2",
              "text": "Marketing system || बजारीकरण प्रणाली"
            },
            {
              "id": "3",
              "text": "Production system || उत्पादन प्रणाली"
            },
            {
              "id": "4",
              "text": "Sales system || बिक्री प्रणाली"
            }
          ],
          "difficulty": "medium",
          "question": "Which system is used to keep and organize official documents? || आधिकारिक कागजातहरू सुरक्षित तथा व्यवस्थित राख्न कुन प्रणाली प्रयोग गरिन्छ ?",
          "correctOption": 1,
          "explanation": "A filing system helps store, organize, and retrieve official documents efficiently. || फाइलिङ प्रणालीले आधिकारिक कागजातहरू व्यवस्थित रूपमा राख्न र आवश्यक पर्दा खोज्न सहयोग गर्छ।",
          "questionId": "pm-topic-010-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Efficiency || कार्यदक्षता"
            },
            {
              "id": "2",
              "text": "Centralization || केन्द्रीकरण"
            },
            {
              "id": "3",
              "text": "Secrecy || गोपनीयता"
            },
            {
              "id": "4",
              "text": "Formality || औपचारिकता"
            }
          ],
          "difficulty": "hard",
          "question": "Which principle of office management emphasizes doing work with minimum time and resources? || न्यूनतम समय र स्रोतसाधन प्रयोग गरी काम सम्पन्न गर्ने कार्यालय व्यवस्थापनको सिद्धान्त कुन हो ?",
          "correctOption": 1,
          "explanation": "Efficiency means achieving desired results with minimum use of time, effort, and resources. || कार्यदक्षता भन्नाले न्यूनतम समय, प्रयास तथा स्रोतसाधन प्रयोग गरी अपेक्षित परिणाम प्राप्त गर्नु हो।",
          "questionId": "pm-topic-010-q-003"
        }
      ],
      "topicId": "pm-topic-010"
    },
    {
      "titleEn": "Human Resource Management",
      "titleNp": "मानव संसाधन व्यवस्थापन",
      "slug": "human-resource-management",
      "featureId": "pm",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Employees || कर्मचारी"
            },
            {
              "id": "2",
              "text": "Machines || मेसिन"
            },
            {
              "id": "3",
              "text": "Buildings || भवन"
            },
            {
              "id": "4",
              "text": "Raw materials || कच्चा पदार्थ"
            }
          ],
          "difficulty": "easy",
          "question": "What is the main focus of human resource management? || मानव संसाधन व्यवस्थापनको मुख्य केन्द्र के हो ?",
          "correctOption": 1,
          "explanation": "Human resource management focuses on managing and developing employees effectively. || मानव संसाधन व्यवस्थापनले कर्मचारीको प्रभावकारी व्यवस्थापन तथा विकासमा ध्यान दिन्छ।",
          "questionId": "pm-topic-011-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Recruitment || भर्ती"
            },
            {
              "id": "2",
              "text": "Promotion || बढुवा"
            },
            {
              "id": "3",
              "text": "Retirement || अवकाश"
            },
            {
              "id": "4",
              "text": "Transfer || सरुवा"
            }
          ],
          "difficulty": "medium",
          "question": "Which process involves finding and attracting qualified candidates for a job? || कुनै पदका लागि योग्य उम्मेदवार खोज्ने तथा आकर्षित गर्ने प्रक्रियालाई के भनिन्छ ?",
          "correctOption": 1,
          "explanation": "Recruitment is the process of finding and attracting suitable candidates for employment. || भर्ती भनेको रोजगारीका लागि उपयुक्त उम्मेदवार खोज्ने तथा आकर्षित गर्ने प्रक्रिया हो।",
          "questionId": "pm-topic-011-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Training and development || तालिम तथा विकास"
            },
            {
              "id": "2",
              "text": "Retirement || अवकाश"
            },
            {
              "id": "3",
              "text": "Dismissal || बर्खास्ती"
            },
            {
              "id": "4",
              "text": "Transfer || सरुवा"
            }
          ],
          "difficulty": "hard",
          "question": "Which activity helps employees improve their knowledge and skills for better job performance? || राम्रो कार्यसम्पादनका लागि कर्मचारीको ज्ञान तथा सीप सुधार गर्न कुन गतिविधिले सहयोग गर्छ ?",
          "correctOption": 1,
          "explanation": "Training and development improve employees' knowledge, skills, and abilities for better performance. || तालिम तथा विकासले कर्मचारीको ज्ञान, सीप र क्षमता वृद्धि गरी कार्यसम्पादन सुधार गर्न सहयोग गर्छ।",
          "questionId": "pm-topic-011-q-003"
        }
      ],
      "topicId": "pm-topic-011"
    },
    {
      "titleEn": "Leadership and Motivation",
      "titleNp": "नेतृत्व तथा उत्प्रेरणा",
      "slug": "leadership-and-motivation",
      "featureId": "pm",
      "questions": [
        {
          "order": 1,
          "options": [
            {
              "id": "1",
              "text": "Influencing and guiding people toward a goal || लक्ष्यतर्फ मानिसहरूलाई प्रभाव पार्दै मार्गदर्शन गर्नु"
            },
            {
              "id": "2",
              "text": "Avoiding responsibility || जिम्मेवारीबाट भाग्नु"
            },
            {
              "id": "3",
              "text": "Working without a goal || लक्ष्यविना काम गर्नु"
            },
            {
              "id": "4",
              "text": "Controlling machines only || केवल मेसिन नियन्त्रण गर्नु"
            }
          ],
          "difficulty": "easy",
          "question": "What is leadership? || नेतृत्व भनेको के हो ?",
          "correctOption": 1,
          "explanation": "Leadership is the ability to influence and guide people toward achieving common goals. || नेतृत्व भनेको साझा लक्ष्य प्राप्त गर्न मानिसहरूलाई प्रभाव पार्ने र मार्गदर्शन गर्ने क्षमता हो।",
          "questionId": "pm-topic-012-q-001"
        },
        {
          "order": 2,
          "options": [
            {
              "id": "1",
              "text": "Good communication || राम्रो सञ्चार"
            },
            {
              "id": "2",
              "text": "Ignoring employees || कर्मचारीलाई बेवास्ता गर्नु"
            },
            {
              "id": "3",
              "text": "Avoiding decisions || निर्णयबाट टाढा रहनु"
            },
            {
              "id": "4",
              "text": "Lack of responsibility || जिम्मेवारीको अभाव"
            }
          ],
          "difficulty": "medium",
          "question": "Which of the following is an important quality of an effective leader? || प्रभावकारी नेताको महत्वपूर्ण गुणमध्ये कुन हो ?",
          "correctOption": 1,
          "explanation": "Good communication helps leaders clearly share goals, instructions, and feedback with their team. || राम्रो सञ्चारले नेताहरूलाई टोलीसँग लक्ष्य, निर्देशन तथा प्रतिक्रिया स्पष्ट रूपमा आदानप्रदान गर्न सहयोग गर्छ।",
          "questionId": "pm-topic-012-q-002"
        },
        {
          "order": 3,
          "options": [
            {
              "id": "1",
              "text": "Maslow's Hierarchy of Needs || मास्लोको आवश्यकताको पदानुक्रम सिद्धान्त"
            },
            {
              "id": "2",
              "text": "Herzberg's Two-Factor Theory || हर्जबर्गको दुई-कारक सिद्धान्त"
            },
            {
              "id": "3",
              "text": "McGregor's Theory X || म्याकग्रेगरको सिद्धान्त X"
            },
            {
              "id": "4",
              "text": "Taylor's Scientific Management || टेलरको वैज्ञानिक व्यवस्थापन"
            }
          ],
          "difficulty": "hard",
          "question": "Which theory explains that human needs are arranged in a hierarchy from basic needs to self-actualization? || आधारभूत आवश्यकतादेखि आत्मसाक्षात्कारसम्म मानवीय आवश्यकताहरू तहगत रूपमा रहेका छन् भन्ने सिद्धान्त कुन हो ?",
          "correctOption": 1,
          "explanation": "Maslow's theory arranges human needs in a hierarchy, from physiological needs to self-actualization. || मास्लोको सिद्धान्तले मानवीय आवश्यकताहरूलाई शारीरिक आवश्यकतादेखि आत्मसाक्षात्कारसम्म तहगत रूपमा प्रस्तुत गर्छ।",
          "questionId": "pm-topic-012-q-003"
        }
      ],
      "topicId": "pm-topic-012"
    }
  ]
} as const;
