with open('frontend/src/App.tsx', 'r') as f:
    content = f.read()

target = '<button \n                      type="submit" \n                      disabled={predicting}'
if target not in content:
    target = '<button \n                      type="submit"'

if target not in content:
    target = 'type="submit"'

# Let's just find the exact index
idx = content.find('disabled={predicting}')
if idx == -1:
    print("Could not find disabled={predicting}")
else:
    # go back to <button
    btn_idx = content.rfind('<button', 0, idx)
    
    replacement = """
                    <div>
                      <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] uppercase tracking-wider">Length of Stay (Days)</label>
                      <input 
                        type="number" 
                        min="1"
                        max="30"
                        className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                        value={mlForm.length_of_stay}
                        onChange={e => setMlForm({...mlForm, length_of_stay: parseInt(e.target.value) || 1})}
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] uppercase tracking-wider">Previous Admissions</label>
                      <input 
                        type="number" 
                        min="0"
                        max="10"
                        className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                        value={mlForm.previous_admissions}
                        onChange={e => setMlForm({...mlForm, previous_admissions: parseInt(e.target.value) || 0})}
                      />
                    </div>
    """
    
    content = content[:btn_idx] + replacement + content[btn_idx:]
    with open('frontend/src/App.tsx', 'w') as f:
        f.write(content)
    print("Patched successfully")
