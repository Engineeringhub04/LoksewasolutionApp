from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

ZIP_PATH = Path('/home/ubuntu/upload/syllabus_question_bank_8200_mcqs.zip')
OUTPUT_PATH = Path('/home/ubuntu/LoksewasolutionApp/src/core/firebase/learningQuestionBank.ts')

TECHNICAL_UNITS = {
    1: ('surveying', 'surveying'),
    2: ('construction-materials', 'construction-materials'),
    3: ('mechanics-materials-structures', 'mechanics'),
    4: ('hydraulics', 'hydraulics'),
    5: ('soil-mechanics', 'soil'),
    6: ('structural-design', 'structural'),
    7: ('building-construction-technology', 'building'),
    8: ('water-supply-sanitation', 'water'),
    9: ('irrigation-engineering', 'irrigation'),
    10: ('highway-engineering', 'highway'),
    11: ('estimating-costing', 'estimating'),
    12: ('construction-management', 'management'),
    13: ('airport-engineering', 'airport'),
}

OPTION_RE = re.compile(r'^([A-D])\.\s*(.*?)\s*$')
QUESTION_RE = re.compile(r'^##\s*प्रश्न\s+([0-9०-९]+)\s*$')
ANSWER_RE = re.compile(r'^\*\*सही विकल्प:\*\*\s*([A-D])\s*$')
EXPLANATION_RE = re.compile(r'^\*\*व्याख्या:\*\*\s*(.*?)\s*$')
LEVEL_RE = re.compile(r'^\*\*स्तर:\*\*\s*(.*?)\s*$')
FILE_RE = re.compile(r'^question_bank/(GA|PM|Technical)/Unit_(\d+)/(\d+)\.(\d+)_.*\.md$')


def nepali_number(value: str) -> int:
    digits = str.maketrans('०१२३४५६७८९', '0123456789')
    return int(value.translate(digits))


def parse_file(name: str, text: str) -> list[dict]:
    match = FILE_RE.match(name)
    if not match:
        raise ValueError(f'Unsupported filename: {name}')
    category, unit_number, chapter_number, _ = match.groups()
    unit_number = int(unit_number)
    chapter_number = int(chapter_number)

    if category == 'GA':
        subject_id = 'general-awareness'
        unit_id = None
        chapter_id = f'ga-1-{chapter_number}'
    elif category == 'PM':
        subject_id = 'public-management'
        unit_id = None
        chapter_id = f'pm-2-{chapter_number}'
    else:
        unit_id, chapter_prefix = TECHNICAL_UNITS[unit_number]
        subject_id = 'job-based-knowledge'
        chapter_id = f'{chapter_prefix}-{unit_number}-{chapter_number}'

    # Repair one generated source variant where C/D options were embedded in a Python-dict-like string.
    text = re.sub(r"',\s*'([A-D])'\s*:\s*'", lambda match: f"\n{match.group(1)}. ", text)
    text = re.sub(r'\nC\.\s*B\s*\nD\.\s*\n(\*\*सही विकल्प)', r'\n\1', text)
    lines = [line.strip() for line in text.splitlines()]
    records: list[dict] = []
    index = 0
    while index < len(lines):
        question_match = QUESTION_RE.match(lines[index])
        if not question_match:
            index += 1
            continue
        question_number = nepali_number(question_match.group(1))
        index += 1

        question_lines: list[str] = []
        while index < len(lines) and not OPTION_RE.match(lines[index]) and not QUESTION_RE.match(lines[index]):
            if index + 3 < len(lines) and lines[index] and lines[index + 1].startswith('B.') and lines[index + 2].startswith('C.') and lines[index + 3].startswith('D.'):
                break
            if lines[index] and not lines[index].startswith('---'):
                question_lines.append(lines[index])
            index += 1
        options: list[str] = []
        if index + 3 < len(lines) and lines[index] and lines[index + 1].startswith('B.') and lines[index + 2].startswith('C.') and lines[index + 3].startswith('D.'):
            options.append(lines[index])
            index += 1
        while index < len(lines):
            if not lines[index]:
                index += 1
                continue
            option_match = OPTION_RE.match(lines[index])
            if option_match:
                options.append(option_match.group(2).strip())
                index += 1
                continue
            if options and not lines[index].startswith(('**सही विकल्प:', '**व्याख्या:', '**स्तर:', '---')):
                options[-1] = f"{options[-1]} {lines[index]}".strip()
                index += 1
                continue
            break
        answer = None
        explanation = ''
        difficulty = 'medium'
        while index < len(lines) and not QUESTION_RE.match(lines[index]):
            line = lines[index]
            answer_match = ANSWER_RE.match(line)
            explanation_match = EXPLANATION_RE.match(line)
            level_match = LEVEL_RE.match(line)
            if answer_match:
                answer = answer_match.group(1)
            elif explanation_match:
                explanation = explanation_match.group(1).strip()
            elif level_match:
                level = level_match.group(1).strip()
                difficulty = {'简单': 'easy', '简单': 'easy', '容易': 'easy', '中等': 'medium', '困难': 'hard', '较难': 'hard', 'सजिलो': 'easy', 'मध्यम': 'medium', 'कठिन': 'hard'}.get(level, 'medium')
            index += 1
        if len(options) != 4 or answer not in {'A', 'B', 'C', 'D'} or not question_lines:
            raise ValueError(f'Invalid question {name} #{question_number}: options={len(options)} answer={answer}')
        question_text = ' '.join(question_lines).strip()
        correct_index = 'ABCD'.index(answer)
        stable_id = f'{subject_id}__{chapter_id}__q-{question_number:03d}'
        records.append({
            'sourceId': stable_id,
            'subjectId': subject_id,
            'unitId': unit_id,
            'chapterId': chapter_id,
            'mode': 'practice',
            'text': question_text,
            'textNe': question_text,
            'options': options,
            'optionsNe': options,
            'correctIndex': correct_index,
            'explanation': explanation,
            'explanationNe': explanation,
            'difficulty': difficulty,
            'isPublished': True,
        })
    return records


def main() -> None:
    all_records: list[dict] = []
    source_files = 0
    with zipfile.ZipFile(ZIP_PATH) as archive:
        for name in sorted(archive.namelist()):
            if not name.endswith('.md') or not name.startswith('question_bank/'):
                continue
            source_files += 1
            all_records.extend(parse_file(name, archive.read(name).decode('utf-8')))
    if source_files != 82 or len(all_records) != 8200:
        raise SystemExit(f'Unexpected source size: files={source_files}, questions={len(all_records)}')
    output = (
        "// Generated from the validated 8,200-question Civil Sub Engineer question bank.\n"
        "// Do not edit individual records manually; regenerate from the source archive.\n"
        "export interface LearningQuestionSeedRecord {\n"
        "  sourceId: string;\n"
        "  subjectId: string;\n"
        "  unitId: string | null;\n"
        "  chapterId: string;\n"
        "  mode: 'practice' | 'read';\n"
        "  text: string;\n"
        "  textNe: string;\n"
        "  options: string[];\n"
        "  optionsNe: string[];\n"
        "  correctIndex: number;\n"
        "  explanation: string;\n"
        "  explanationNe: string;\n"
        "  difficulty: 'easy' | 'medium' | 'hard';\n"
        "  isPublished: boolean;\n"
        "}\n\n"
        f"export const learningQuestionBankSeed: LearningQuestionSeedRecord[] = {json.dumps(all_records, ensure_ascii=False, indent=2)};\n"
    )
    OUTPUT_PATH.write_text(output, encoding='utf-8')
    print(json.dumps({'sourceFiles': source_files, 'questions': len(all_records), 'output': str(OUTPUT_PATH)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
