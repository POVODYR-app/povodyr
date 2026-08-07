const saveCategories = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        alert('Помилка: користувач не авторизований');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ categories: selectedCategories })
        .eq('id', userData.user.id);

      if (error) {
        console.error('Помилка збереження категорій:', error);
        alert(`Не вдалося зберегти категорії: ${error.message}`);
        return;
      }

      setShowCategoriesModal(false);
      await loadUserProfile(); // Оновлюємо дані на сторінці
      alert('Категорії успішно оновлено!');
    } catch (err: any) {
      console.error(err);
      alert('Виникла помилка при збереженні категорій');
    }
  };

  const saveProfile = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        alert('Помилка: користувач не авторизований');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userName,
          role: userRole,
          art_style: artStyle,
          city: city,
          portfolio: portfolio,
          bio: bio,
        })
        .eq('id', userData.user.id);

      if (error) {
        console.error('Помилка збереження профілю:', error);
        alert(`Не вдалося зберегти профіль: ${error.message}`);
        return;
      }

      setShowProfileModal(false);
      await loadUserProfile();
      alert('Профіль успішно оновлено!');
    } catch (err: any) {
      console.error(err);
      alert('Виникла помилка при збереженні профілю');
    }
  };
