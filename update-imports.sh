for file in src/components/*.tsx src/lib/*.ts; do
  if grep -q "dexie-react-hooks" "$file"; then
    sed -i "s/import { useLiveQuery } from 'dexie-react-hooks';/import { useSupabaseQuery as useLiveQuery } from '..\/lib\/useSupabaseQuery';/" "$file"
  fi
done
